import { Inject, Injectable } from '@nestjs/common'
import { AuditAction, Prisma } from '@edgecontrol/db'

import { AuthenticatedUser } from '../../auth/auth.types'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async log(params: {
    actor: string
    action: AuditAction
    target: string
    oldValue?: Record<string, unknown> | null
    newValue?: Record<string, unknown> | null
  }) {
    return this.prisma.auditLog.create({
      data: {
        actor: params.actor,
        action: params.action,
        target: params.target,
        oldValue: (params.oldValue as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        newValue: (params.newValue as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull
      }
    })
  }

  async list(limit = 50, _actor?: AuthenticatedUser) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  }
}
