import { z } from 'zod'

export const roleSchema = z.enum(['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'VIEWER'])

export const serviceStatusSchema = z.enum(['UP', 'SLOW', 'DOWN'])
export const alertSeveritySchema = z.enum(['INFO', 'WARNING', 'CRITICAL'])
export const alertStatusSchema = z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED'])
export const circuitBreakerStatusSchema = z.enum(['OPEN', 'CLOSED', 'HALF_OPEN'])
export const serviceTypeSchema = z.enum(['api', 'ai', 'ws', 'web', 'worker'])

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  targetHost: z.string(),
  targetPort: z.number().int(),
  protocol: z.enum(['http', 'https']).default('http'),
  type: serviceTypeSchema.default('api'),
  enabled: z.boolean(),
  weight: z.number().int().min(0).max(100),
  healthPath: z.string().default('/'),
  rateLimitAvg: z.number().int().nullable(),
  rateLimitBurst: z.number().int().nullable(),
  circuitBreakerEnabled: z.boolean(),
  circuitBreakerStatus: circuitBreakerStatusSchema.default('CLOSED'),
  fallbackServiceId: z.string().nullable(),
  tags: z.array(z.string()),
  notes: z.string().nullable(),
  nodeId: z.string().nullable().optional(),
  metricsEnabled: z.boolean().default(false),
  metricsPath: z.string().default('/metrics'),
  metricsPort: z.number().int().positive().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const createServiceSchema = serviceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  circuitBreakerStatus: true
})

export const updateServiceSchema = createServiceSchema.extend({
  id: z.string()
})

export const healthCheckSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  status: serviceStatusSchema,
  latencyMs: z.number().int(),
  statusCode: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  checkedAt: z.string()
})

export const alertSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  severity: alertSeveritySchema,
  message: z.string(),
  status: alertStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable()
})

export const routeVersionSchema = z.object({
  id: z.string(),
  versionName: z.string(),
  configSnapshot: z.record(z.any()),
  createdBy: z.string(),
  createdAt: z.string(),
  isActive: z.boolean()
})

export const auditLogSchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  target: z.string(),
  oldValue: z.record(z.any()).nullable(),
  newValue: z.record(z.any()).nullable(),
  createdAt: z.string()
})

export const dashboardSummarySchema = z.object({
  totalServices: z.number().int(),
  upServices: z.number().int(),
  slowServices: z.number().int(),
  downServices: z.number().int(),
  openAlerts: z.number().int()
})

export type ServiceDto = z.infer<typeof serviceSchema>
export type CreateServiceInput = z.infer<typeof createServiceSchema>
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>
export type HealthCheckDto = z.infer<typeof healthCheckSchema>
export type AlertDto = z.infer<typeof alertSchema>
export type RouteVersionDto = z.infer<typeof routeVersionSchema>
export type AuditLogDto = z.infer<typeof auditLogSchema>
export type DashboardSummaryDto = z.infer<typeof dashboardSummarySchema>

export const nodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  host: z.string(),
  region: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string()
})

export const createNodeSchema = z.object({
  name: z.string().min(1).max(128),
  host: z.string().min(1).max(512),
  region: z.string().max(64).nullable().optional()
})

export type NodeDto = z.infer<typeof nodeSchema>
export type CreateNodeInput = z.infer<typeof createNodeSchema>
