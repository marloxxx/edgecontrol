import { Injectable } from '@nestjs/common'
import { ServiceStatus } from '@edgecontrol/db'

import { AuthenticatedUser } from '../../auth/auth.types'
import { env } from '../../config/env'
import { PrismaService } from '../../prisma/prisma.service'
import { AccessControlService } from '../access/access-control.service'

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService
  ) {}

  async testConnection(serviceId: string, actor: AuthenticatedUser) {
    await this.accessControlService.assertCanViewService(actor, serviceId)
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } })
    if (!service) {
      throw new Error('Service not found')
    }

    const endpoint = `${service.protocol}://${service.targetHost}:${service.targetPort}${service.healthPath}`
    const startedAt = Date.now()

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })

      const latencyMs = Date.now() - startedAt
      const status = this.resolveStatus(response.ok, latencyMs)
      return {
        status,
        latencyMs,
        statusCode: response.status,
        errorMessage: null
      }
    } catch (error) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - startedAt,
        statusCode: null,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async recordCheck(input: {
    serviceId: string
    status: ServiceStatus
    latencyMs: number
    statusCode: number | null
    errorMessage: string | null
  }) {
    return this.prisma.healthCheck.create({
      data: {
        serviceId: input.serviceId,
        status: input.status,
        latencyMs: input.latencyMs,
        statusCode: input.statusCode,
        errorMessage: input.errorMessage
      }
    })
  }

  async getByService(serviceId: string, limit = 50, actor: AuthenticatedUser) {
    await this.accessControlService.assertCanViewService(actor, serviceId)
    return this.prisma.healthCheck.findMany({
      where: { serviceId },
      orderBy: { checkedAt: 'desc' },
      take: limit
    })
  }

  async getLatestAll(actor: AuthenticatedUser) {
    const where = await this.accessControlService.getAccessibleServiceWhere(actor)
    const services = await this.prisma.service.findMany({
      where: {
        enabled: true,
        ...(where ?? {})
      }
    })

    const checks = await Promise.all(
      services.map(async (service) => {
        const latest = await this.prisma.healthCheck.findFirst({
          where: { serviceId: service.id },
          orderBy: { checkedAt: 'desc' }
        })

        return {
          serviceId: service.id,
          serviceName: service.name,
          status: latest?.status ?? ServiceStatus.UP,
          latencyMs: latest?.latencyMs ?? 0,
          statusCode: latest?.statusCode ?? null,
          checkedAt: latest?.checkedAt?.toISOString() ?? new Date().toISOString()
        }
      })
    )

    return checks
  }

  private resolveStatus(ok: boolean, latencyMs: number): ServiceStatus {
    if (!ok) return ServiceStatus.DOWN
    if (latencyMs > env.LATENCY_WARN_MS) return ServiceStatus.SLOW
    return ServiceStatus.UP
  }
}
