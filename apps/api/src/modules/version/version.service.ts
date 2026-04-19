import { Inject, Injectable } from '@nestjs/common'
import { AuditAction, Prisma } from '@edgecontrol/db'

import { AuthenticatedUser } from '../../auth/auth.types'
import { PrometheusTargetsService } from '../../infra/prometheus/prometheus-targets.service'
import { TraefikService } from '../../infra/traefik/traefik.service'
import { PrismaService } from '../../prisma/prisma.service'
import { AccessControlService } from '../access/access-control.service'
import { AuditService } from '../audit/audit.service'

@Injectable()
export class VersionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TraefikService) private readonly traefikService: TraefikService,
    @Inject(PrometheusTargetsService) private readonly prometheusTargets: PrometheusTargetsService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(AccessControlService) private readonly accessControlService: AccessControlService
  ) {}

  async regenerate(actor: AuthenticatedUser) {
    const where = await this.accessControlService.getAccessibleServiceWhere(actor)
    const routes = await this.prisma.service.findMany({
      where: {
        enabled: true,
        ...(where ?? {})
      }
    })

    const config = this.traefikService.buildConfig(
      routes.map((route) => ({
        domain: route.domain,
        targetHost: route.targetHost,
        targetPort: route.targetPort,
        protocol: route.protocol,
        healthPath: route.healthPath,
        traefikHealthCheck: route.traefikHealthCheck,
        rateLimitAvg: route.rateLimitAvg,
        rateLimitBurst: route.rateLimitBurst,
        circuitBreakerEnabled: route.circuitBreakerEnabled,
        circuitBreakerStatus: route.circuitBreakerStatus,
        weight: route.weight
      }))
    )

    this.traefikService.writeConfig(config)

    await this.prisma.routeVersion.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    })

    const version = await this.prisma.routeVersion.create({
      data: {
        versionName: `v${Date.now()}`,
        configSnapshot: config as Prisma.InputJsonValue,
        createdBy: actor.email,
        isActive: true
      }
    })

    await this.auditService.log({
      actor: actor.email,
      action: AuditAction.UPDATE,
      target: 'config:dynamic.d/01-managed.yml',
      newValue: { versionId: version.id }
    })

    await this.prometheusTargets.syncFromServices()

    return {
      success: true,
      versionId: version.id
    }
  }

  async rollback(versionId: string, actor: AuthenticatedUser) {
    const version = await this.prisma.routeVersion.findUnique({
      where: { id: versionId }
    })
    if (!version) {
      throw new Error('Version not found')
    }

    this.traefikService.writeConfig(version.configSnapshot as Record<string, unknown>)

    await this.prisma.routeVersion.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    })

    await this.prisma.routeVersion.update({
      where: { id: versionId },
      data: { isActive: true }
    })

    await this.auditService.log({
      actor: actor.email,
      action: AuditAction.ROLLBACK,
      target: `config:${version.versionName}`,
      newValue: { versionId }
    })

    return { success: true }
  }

  async listVersions(_actor: AuthenticatedUser) {
    return this.prisma.routeVersion.findMany({
      orderBy: { createdAt: 'desc' }
    })
  }

  getCurrent(_actor: AuthenticatedUser) {
    return {
      yaml: this.traefikService.readCurrentYaml()
    }
  }
}
