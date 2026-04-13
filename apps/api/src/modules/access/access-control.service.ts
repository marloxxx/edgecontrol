import { ForbiddenException, Injectable } from '@nestjs/common'
import { AuditAction, Prisma } from '@edgecontrol/db'
import { normalizeRole } from '@edgecontrol/trpc'

import { AuthenticatedUser } from '../../auth/auth.types'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

@Injectable()
export class AccessControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  isPrivileged(user: AuthenticatedUser): boolean {
    const role = normalizeRole(user.role)
    return role === 'SUPER_ADMIN' || role === 'ADMIN'
  }

  async getAccessibleServiceWhere(user: AuthenticatedUser): Promise<Prisma.ServiceWhereInput | undefined> {
    if (this.isPrivileged(user)) {
      return undefined
    }

    return {
      accessList: {
        some: { userId: user.id }
      }
    }
  }

  async canViewService(user: AuthenticatedUser, serviceId: string): Promise<boolean> {
    if (this.isPrivileged(user)) {
      return true
    }

    const access = await this.prisma.serviceAccess.findUnique({
      where: {
        userId_serviceId: {
          userId: user.id,
          serviceId
        }
      }
    })

    return Boolean(access)
  }

  async canEditService(user: AuthenticatedUser, serviceId: string): Promise<boolean> {
    if (this.isPrivileged(user)) {
      return true
    }

    const access = await this.prisma.serviceAccess.findUnique({
      where: {
        userId_serviceId: {
          userId: user.id,
          serviceId
        }
      }
    })

    return Boolean(access?.canEdit)
  }

  async assertCanViewService(user: AuthenticatedUser, serviceId: string) {
    if (await this.canViewService(user, serviceId)) {
      return
    }

    await this.logDenied(user, 'view:service', serviceId)
    throw new ForbiddenException('You do not have access to this service')
  }

  async assertCanEditService(user: AuthenticatedUser, serviceId: string) {
    if (await this.canEditService(user, serviceId)) {
      return
    }

    await this.logDenied(user, 'edit:service', serviceId)
    throw new ForbiddenException('You do not have edit access to this service')
  }

  private async logDenied(user: AuthenticatedUser, operation: string, serviceId: string) {
    try {
      await this.auditService.log({
        actor: user.email,
        action: AuditAction.UPDATE,
        target: `rbac-denied:${operation}`,
        newValue: {
          userId: user.id,
          role: normalizeRole(user.role),
          serviceId
        }
      })
    } catch {
      // RBAC checks must still fail closed even when audit logging fails.
    }
  }
}
