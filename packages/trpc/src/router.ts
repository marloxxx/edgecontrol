import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'

import { Permission, hasPermission } from './permissions'
import {
  createNodeSchema,
  createServiceSchema,
  updateServiceSchema
} from './types'

export interface RouterContext {
  user?: {
    id: string
    email: string
    role: string
  }
}

type RouterUser = NonNullable<RouterContext['user']>

export interface AppRouterDeps {
  service: {
    list: (actor: RouterUser) => Promise<any[]>
    getById: (id: string, actor: RouterUser) => Promise<any | null>
    create: (input: z.infer<typeof createServiceSchema>, actor: RouterUser) => Promise<any>
    update: (input: z.infer<typeof updateServiceSchema>, actor: RouterUser) => Promise<any>
    delete: (id: string, actor: RouterUser) => Promise<{ success: boolean }>
    toggle: (id: string, enabled: boolean, actor: RouterUser) => Promise<any>
    testConnection: (id: string, actor: RouterUser) => Promise<{ status: string; latencyMs: number; statusCode: number | null; errorMessage: string | null }>
  }
  health: {
    getByService: (serviceId: string, limit: number, actor: RouterUser) => Promise<any[]>
    getLatestAll: (actor: RouterUser) => Promise<Array<{ serviceId: string; serviceName: string; status: string; latencyMs: number; statusCode: number | null; checkedAt: string }>>
  }
  config: {
    getCurrent: (actor: RouterUser) => Promise<{ yaml: string }>
    getVersions: (actor: RouterUser) => Promise<any[]>
    rollback: (versionId: string, actor: RouterUser) => Promise<{ success: boolean }>
    regenerate: (actor: RouterUser) => Promise<{ success: boolean; versionId: string }>
  }
  alert: {
    list: (status: string | undefined, actor: RouterUser) => Promise<any[]>
    acknowledge: (id: string, actor: RouterUser) => Promise<any>
    resolve: (id: string, actor: RouterUser) => Promise<any>
  }
  audit: {
    list: (limit: number, actor: RouterUser) => Promise<any[]>
  }
  ops: {
    setCircuitBreaker: (id: string, status: 'OPEN' | 'CLOSED', actor: RouterUser) => Promise<any>
    setCanary: (id: string, weight: number, actor: RouterUser) => Promise<any>
    setRateLimit: (id: string, avg: number, burst: number, actor: RouterUser) => Promise<any>
  }
  auth: {
    login: (email: string, password: string) => Promise<{ token: string; user: { id: string; email: string; role: string } }>
    me: (ctx: RouterContext) => Promise<{ id: string; email: string; role: string } | null>
  }
  overview: {
    summary: (actor: RouterUser) => Promise<any>
  }
  node: {
    list: (actor: RouterUser) => Promise<any[]>
    create: (input: z.infer<typeof createNodeSchema>, actor: RouterUser) => Promise<any>
  }
}

const t = initTRPC.context<RouterContext>().create()

const enforceAuth = t.middleware(({ ctx, next }) => {
  const user = ctx?.user
  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  return next({
    ctx: {
      ...ctx,
      user
    }
  })
})

const publicProcedure = t.procedure
const protectedProcedure = t.procedure.use(enforceAuth)
const permissionProcedure = (permission: Permission) =>
  protectedProcedure.use(({ ctx, next }) => {
    const actor = ctx?.user
    if (!actor) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' })
    }
    if (!hasPermission(actor.role, permission)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Required permission: ${permission}`
      })
    }

    return next()
  })

export function createAppRouter(deps: AppRouterDeps) {
  return t.router({
    auth: t.router({
      login: publicProcedure
        .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
        .mutation(({ input }) => deps.auth.login(input.email, input.password)),
      me: publicProcedure.query(({ ctx }) => deps.auth.me(ctx))
    }),
    overview: t.router({
      summary: permissionProcedure(Permission.VIEW_DASHBOARD).query(({ ctx }) => deps.overview.summary(ctx.user))
    }),
    node: t.router({
      list: permissionProcedure(Permission.VIEW_SERVICES).query(({ ctx }) => deps.node.list(ctx.user)),
      create: permissionProcedure(Permission.MANAGE_NODES)
        .input(createNodeSchema)
        .mutation(({ input, ctx }) => deps.node.create(input, ctx.user))
    }),
    service: t.router({
      list: permissionProcedure(Permission.VIEW_SERVICES).query(({ ctx }) => deps.service.list(ctx.user)),
      getById: permissionProcedure(Permission.VIEW_SERVICES)
        .input(z.object({ id: z.string() }))
        .query(({ input, ctx }) => deps.service.getById(input.id, ctx.user)),
      create: permissionProcedure(Permission.CREATE_SERVICE).input(createServiceSchema).mutation(({ input, ctx }) =>
        deps.service.create(input, ctx.user)
      ),
      update: permissionProcedure(Permission.EDIT_SERVICE).input(updateServiceSchema).mutation(({ input, ctx }) =>
        deps.service.update(input, ctx.user)
      ),
      delete: permissionProcedure(Permission.DELETE_SERVICE).input(z.object({ id: z.string() })).mutation(({ input, ctx }) =>
        deps.service.delete(input.id, ctx.user)
      ),
      toggle: permissionProcedure(Permission.TOGGLE_SERVICE)
        .input(z.object({ id: z.string(), enabled: z.boolean() }))
        .mutation(({ input, ctx }) => deps.service.toggle(input.id, input.enabled, ctx.user)),
      testConnection: permissionProcedure(Permission.TEST_CONNECTION)
        .input(z.object({ id: z.string() }))
        .mutation(({ input, ctx }) => deps.service.testConnection(input.id, ctx.user))
    }),
    health: t.router({
      getByService: permissionProcedure(Permission.VIEW_MONITORING)
        .input(z.object({ serviceId: z.string(), limit: z.number().int().min(1).max(500).default(50) }))
        .query(({ input, ctx }) => deps.health.getByService(input.serviceId, input.limit, ctx.user)),
      getLatestAll: permissionProcedure(Permission.VIEW_MONITORING).query(({ ctx }) => deps.health.getLatestAll(ctx.user))
    }),
    config: t.router({
      getCurrent: permissionProcedure(Permission.VIEW_CONFIG).query(({ ctx }) => deps.config.getCurrent(ctx.user)),
      getVersions: permissionProcedure(Permission.VIEW_CONFIG).query(({ ctx }) => deps.config.getVersions(ctx.user)),
      rollback: permissionProcedure(Permission.ROLLBACK_CONFIG)
        .input(z.object({ versionId: z.string() }))
        .mutation(({ input, ctx }) => deps.config.rollback(input.versionId, ctx.user)),
      regenerate: permissionProcedure(Permission.ROLLBACK_CONFIG).mutation(({ ctx }) => deps.config.regenerate(ctx.user))
    }),
    alert: t.router({
      list: permissionProcedure(Permission.VIEW_ALERTS)
        .input(z.object({ status: z.string().optional() }))
        .query(({ input, ctx }) => deps.alert.list(input.status, ctx.user)),
      acknowledge: permissionProcedure(Permission.MANAGE_ALERTS)
        .input(z.object({ id: z.string() }))
        .mutation(({ input, ctx }) => deps.alert.acknowledge(input.id, ctx.user)),
      resolve: permissionProcedure(Permission.MANAGE_ALERTS)
        .input(z.object({ id: z.string() }))
        .mutation(({ input, ctx }) => deps.alert.resolve(input.id, ctx.user))
    }),
    audit: t.router({
      list: permissionProcedure(Permission.VIEW_AUDIT_LOGS)
        .input(z.object({ limit: z.number().default(50) }))
        .query(({ input, ctx }) => deps.audit.list(input.limit, ctx.user))
    }),
    ops: t.router({
      setCircuitBreaker: permissionProcedure(Permission.MANAGE_CIRCUIT_BREAKER)
        .input(z.object({ id: z.string(), status: z.enum(['OPEN', 'CLOSED']) }))
        .mutation(({ input, ctx }) => deps.ops.setCircuitBreaker(input.id, input.status, ctx.user)),
      setCanary: permissionProcedure(Permission.MANAGE_CANARY)
        .input(z.object({ id: z.string(), weight: z.number().int().min(0).max(100) }))
        .mutation(({ input, ctx }) => deps.ops.setCanary(input.id, input.weight, ctx.user)),
      setRateLimit: permissionProcedure(Permission.MANAGE_RATE_LIMIT)
        .input(z.object({ id: z.string(), avg: z.number().int().min(1), burst: z.number().int().min(1) }))
        .mutation(({ input, ctx }) => deps.ops.setRateLimit(input.id, input.avg, input.burst, ctx.user))
    })
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>
