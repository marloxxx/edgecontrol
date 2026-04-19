import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { AuditAction } from '@edgecontrol/db'
import type { CreateServiceInput, UpdateServiceInput } from '@edgecontrol/trpc'

import { AuthenticatedUser } from '../../auth/auth.types'
import { PrometheusTargetsService } from '../../infra/prometheus/prometheus-targets.service'
import { AuditService } from '../audit/audit.service'
import { AccessControlService } from '../access/access-control.service'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ServiceService {
  private readonly logger = new Logger(ServiceService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(AccessControlService) private readonly accessControlService: AccessControlService,
    @Inject(PrometheusTargetsService) private readonly prometheusTargets: PrometheusTargetsService
  ) {}

  async list(actor: AuthenticatedUser) {
    const where = await this.accessControlService.getAccessibleServiceWhere(actor)
    return this.prisma.service.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { node: true }
    })
  }

  async getById(id: string, actor: AuthenticatedUser) {
    await this.accessControlService.assertCanViewService(actor, id)
    return this.prisma.service.findUnique({ where: { id }, include: { node: true } })
  }

  async create(input: CreateServiceInput, actor: AuthenticatedUser) {
    const service = await this.prisma.service.create({
      data: {
        ...input,
        rateLimitAvg: input.rateLimitAvg ?? null,
        rateLimitBurst: input.rateLimitBurst ?? null,
        fallbackServiceId: input.fallbackServiceId ?? null,
        notes: input.notes ?? null
      }
    })

    await this.auditService.log({
      actor: actor.email,
      action: AuditAction.CREATE,
      target: `service:${service.name}`,
      newValue: service as unknown as Record<string, unknown>
    })

    await this.syncPrometheusFileSd()

    return service
  }

  async update(input: UpdateServiceInput, actor: AuthenticatedUser) {
    await this.accessControlService.assertCanEditService(actor, input.id)
    const existing = await this.prisma.service.findUnique({ where: { id: input.id } })
    if (!existing) {
      throw new NotFoundException('Service not found')
    }

    const service = await this.prisma.service.update({
      where: { id: input.id },
      data: {
        ...input,
        rateLimitAvg: input.rateLimitAvg ?? null,
        rateLimitBurst: input.rateLimitBurst ?? null,
        fallbackServiceId: input.fallbackServiceId ?? null,
        notes: input.notes ?? null
      }
    })

    await this.auditService.log({
      actor: actor.email,
      action: AuditAction.UPDATE,
      target: `service:${service.name}`,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: service as unknown as Record<string, unknown>
    })

    await this.syncPrometheusFileSd()

    return service
  }

  async delete(id: string, actor: AuthenticatedUser) {
    await this.accessControlService.assertCanEditService(actor, id)
    const existing = await this.prisma.service.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Service not found')
    }

    await this.prisma.service.delete({ where: { id } })

    await this.auditService.log({
      actor: actor.email,
      action: AuditAction.DELETE,
      target: `service:${existing.name}`,
      oldValue: existing as unknown as Record<string, unknown>
    })

    await this.syncPrometheusFileSd()

    return { success: true }
  }

  async toggle(id: string, enabled: boolean, actor: AuthenticatedUser) {
    await this.accessControlService.assertCanEditService(actor, id)
    const existing = await this.prisma.service.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Service not found')
    }

    const service = await this.prisma.service.update({
      where: { id },
      data: { enabled }
    })

    await this.auditService.log({
      actor: actor.email,
      action: enabled ? AuditAction.ENABLE : AuditAction.DISABLE,
      target: `service:${existing.name}`,
      oldValue: { enabled: existing.enabled },
      newValue: { enabled: service.enabled }
    })

    await this.syncPrometheusFileSd()

    return service
  }

  private async syncPrometheusFileSd(): Promise<void> {
    try {
      await this.prometheusTargets.syncFromServices()
    } catch (err) {
      this.logger.warn(
        `Prometheus file_sd sync failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  async setWeight(id: string, weight: number, actor: AuthenticatedUser) {
    await this.accessControlService.assertCanEditService(actor, id)
    const service = await this.prisma.service.update({
      where: { id },
      data: { weight }
    })

    await this.auditService.log({
      actor: actor.email,
      action: AuditAction.UPDATE,
      target: `service:${service.name}`,
      newValue: { weight }
    })

    return service
  }

  async setCircuitBreaker(
    id: string,
    status: 'OPEN' | 'CLOSED',
    actor: AuthenticatedUser
  ) {
    await this.accessControlService.assertCanEditService(actor, id)
    const service = await this.prisma.service.update({
      where: { id },
      data: {
        circuitBreakerEnabled: true,
        circuitBreakerStatus: status
      }
    })

    await this.auditService.log({
      actor: actor.email,
      action: AuditAction.UPDATE,
      target: `service:${service.name}`,
      newValue: { circuitBreakerStatus: status }
    })

    return service
  }

  async setRateLimit(id: string, avg: number, burst: number, actor: AuthenticatedUser) {
    await this.accessControlService.assertCanEditService(actor, id)
    const service = await this.prisma.service.update({
      where: { id },
      data: {
        rateLimitAvg: avg,
        rateLimitBurst: burst
      }
    })

    await this.auditService.log({
      actor: actor.email,
      action: AuditAction.UPDATE,
      target: `service:${service.name}`,
      newValue: { rateLimitAvg: avg, rateLimitBurst: burst }
    })

    return service
  }
}
