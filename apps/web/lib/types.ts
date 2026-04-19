export type Role = 'VIEWER' | 'DEVELOPER' | 'ADMIN' | 'SUPER_ADMIN'

/** String values align with `@edgecontrol/trpc` `Permission` enum. */
export type Permission =
  | 'view:dashboard'
  | 'view:services'
  | 'create:service'
  | 'edit:service'
  | 'delete:service'
  | 'toggle:service'
  | 'test:connection'
  | 'manage:circuit_breaker'
  | 'manage:canary'
  | 'manage:rate_limit'
  | 'manage:alerts'
  | 'view:config'
  | 'view:monitoring'
  | 'view:alerts'
  | 'view:audit_logs'
  | 'rollback:config'
  | 'view:users'
  | 'create:user'
  | 'edit:user'
  | 'delete:user'
  | 'manage:roles'
  | 'view:settings'
  | 'edit:settings'
  | 'manage:nodes'

export type ServiceStatus = 'UP' | 'SLOW' | 'DOWN' | 'DISABLED'
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO'
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
export type ServiceType = 'api' | 'ai' | 'ws' | 'web' | 'worker'
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK' | 'ENABLE' | 'DISABLE'

export interface Service {
  id: string
  name: string
  domain: string
  targetHost: string
  targetPort: number
  protocol: 'http' | 'https' | 'ws' | 'wss'
  type: ServiceType
  vpsNode: string
  healthCheckPath: string
  status: ServiceStatus
  uptime: number
  avgLatency: number
  errorRate: number
  lastChecked: Date
  enabled: boolean
  rateLimit?: string
  circuitBreaker?: {
    enabled: boolean
    threshold: number
    timeout: number
  }
  tags: string[]
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface Alert {
  id: string
  serviceId: string
  serviceName: string
  severity: AlertSeverity
  message: string
  status: AlertStatus
  vpsNode: string
  createdAt: Date
  acknowledgedAt?: Date
  resolvedAt?: Date
  acknowledgedBy?: string
}

export interface Version {
  id: string
  number: string
  label: string
  isLive: boolean
  config: Record<string, unknown>
  createdAt: Date
  createdBy: string
  deployer?: string
  deployedAt?: Date
}

export interface User {
  id: string
  email: string
  name: string
  role: Role
  avatar?: string
  createdAt: Date
  lastLogin?: Date
}

export interface HealthCheck {
  id: string
  serviceId: string
  status: ServiceStatus
  latency: number
  statusCode?: number
  errorMessage?: string
  timestamp: Date
}

export interface AuditLog {
  id: string
  userId: string
  actor: string
  action: AuditAction
  target: string
  changes?: Record<string, { before: unknown; after: unknown }>
  timestamp: Date
}

export interface VpsNode {
  id: string
  name: string
  ip: string
  region: string
  online: boolean
  cpu: number
  memory: number
  disk: number
}
