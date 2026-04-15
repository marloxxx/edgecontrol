import { INestApplication } from '@nestjs/common'
import { createAppRouter } from '@edgecontrol/trpc/server'
import type { RouterContext } from '@edgecontrol/trpc'

type RouterUser = NonNullable<RouterContext['user']>

import { AuthService } from '../auth/auth.service'
import { AlertService } from '../modules/alert/alert.service'
import { AuditService } from '../modules/audit/audit.service'
import { HealthService } from '../modules/health/health.service'
import { OpsService } from '../modules/ops/ops.service'
import { NodeService } from '../modules/node/node.service'
import { ServiceService } from '../modules/service/service.service'
import { VersionService } from '../modules/version/version.service'

function toJsonDate<T>(record: T): T {
  return JSON.parse(
    JSON.stringify(record, (_, value) =>
      value instanceof Date ? value.toISOString() : value
    )
  ) as T
}

export function buildAppRouter(app: INestApplication) {
  const serviceService = app.get(ServiceService)
  const nodeService = app.get(NodeService)
  const healthService = app.get(HealthService)
  const alertService = app.get(AlertService)
  const auditService = app.get(AuditService)
  const versionService = app.get(VersionService)
  const opsService = app.get(OpsService)
  const authService = app.get(AuthService)

  return createAppRouter({
    auth: {
      login: (email, password) => authService.login(email, password),
      me: (ctx) => authService.me(ctx)
    },
    node: {
      list: async (actor: RouterUser) => toJsonDate(await nodeService.list(actor)),
      create: async (input, actor) => toJsonDate(await nodeService.create(input, actor))
    },
    overview: {
      async summary(actor: RouterUser) {
        const services = await serviceService.list(actor)
        const openAlerts = await alertService.list('OPEN', actor)

        const summary = {
          totalServices: services.length,
          upServices: 0,
          slowServices: 0,
          downServices: 0,
          openAlerts: openAlerts.length
        }

        for (const service of services) {
          const latest = await healthService.getByService(service.id, 1, actor)
          const status = latest[0]?.status ?? 'UP'
          if (status === 'DOWN') summary.downServices += 1
          else if (status === 'SLOW') summary.slowServices += 1
          else summary.upServices += 1
        }

        return summary
      }
    },
    service: {
      list: async (actor: RouterUser) => toJsonDate(await serviceService.list(actor)),
      getById: async (id, actor: RouterUser) => {
        const service = await serviceService.getById(id, actor)
        return service ? toJsonDate(service) : null
      },
      create: async (input, actor) => toJsonDate(await serviceService.create(input, actor)),
      update: async (input, actor) => toJsonDate(await serviceService.update(input, actor)),
      delete: (id, actor) => serviceService.delete(id, actor),
      toggle: async (id, enabled, actor) => toJsonDate(await serviceService.toggle(id, enabled, actor)),
      testConnection: (id, actor: RouterUser) => healthService.testConnection(id, actor)
    },
    health: {
      getByService: async (serviceId, limit, actor: RouterUser) =>
        toJsonDate(await healthService.getByService(serviceId, limit, actor)),
      getLatestAll: (actor: RouterUser) => healthService.getLatestAll(actor)
    },
    config: {
      getCurrent: async (actor: RouterUser) => versionService.getCurrent(actor),
      getVersions: async (actor: RouterUser) => toJsonDate(await versionService.listVersions(actor)),
      rollback: (versionId, actor) => versionService.rollback(versionId, actor),
      regenerate: (actor) => versionService.regenerate(actor)
    },
    alert: {
      list: async (status, actor: RouterUser) => toJsonDate(await alertService.list(status, actor)),
      acknowledge: async (id, actor: RouterUser) => toJsonDate(await alertService.acknowledge(id, actor)),
      resolve: async (id, actor: RouterUser) => toJsonDate(await alertService.resolve(id, actor))
    },
    audit: {
      list: async (limit, actor: RouterUser) => toJsonDate(await auditService.list(limit, actor))
    },
    ops: {
      setCircuitBreaker: async (id, status, actor) =>
        toJsonDate(await opsService.setCircuitBreaker(id, status, actor)),
      setCanary: async (id, weight, actor) =>
        toJsonDate(await opsService.setCanary(id, weight, actor)),
      setRateLimit: async (id, avg, burst, actor) =>
        toJsonDate(await opsService.setRateLimit(id, avg, burst, actor))
    }
  })
}
