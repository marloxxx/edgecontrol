import { Injectable } from '@nestjs/common'
import { AlertSeverity, AlertStatus } from '@edgecontrol/db'

import { AuthenticatedUser } from '../../auth/auth.types'
import { PrismaService } from '../../prisma/prisma.service'
import { AccessControlService } from '../access/access-control.service'

@Injectable()
export class AlertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService
  ) {}

  async list(status: string | undefined, actor: AuthenticatedUser) {
    const serviceWhere = await this.accessControlService.getAccessibleServiceWhere(actor)
    return this.prisma.alert.findMany({
      where: {
        ...(status ? { status: status as AlertStatus } : {}),
        ...(serviceWhere ? { service: serviceWhere } : {})
      },
      include: { service: true },
      orderBy: { createdAt: 'desc' }
    })
  }

  async create(input: {
    serviceId: string
    severity: AlertSeverity
    message: string
  }) {
    const latestOpen = await this.prisma.alert.findFirst({
      where: {
        serviceId: input.serviceId,
        status: AlertStatus.OPEN,
        message: input.message
      },
      orderBy: { createdAt: 'desc' }
    })

    if (latestOpen) {
      return latestOpen
    }

    return this.prisma.alert.create({
      data: input
    })
  }

  async acknowledge(id: string, actor: AuthenticatedUser) {
    const alert = await this.prisma.alert.findUnique({ where: { id } })
    if (alert) {
      await this.accessControlService.assertCanEditService(actor, alert.serviceId)
    }

    return this.prisma.alert.update({
      where: { id },
      data: { status: AlertStatus.ACKNOWLEDGED }
    })
  }

  async resolve(id: string, actor: AuthenticatedUser) {
    const alert = await this.prisma.alert.findUnique({ where: { id } })
    if (alert) {
      await this.accessControlService.assertCanEditService(actor, alert.serviceId)
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date()
      }
    })
  }
}
