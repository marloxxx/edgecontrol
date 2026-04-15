export enum Permission {
  VIEW_DASHBOARD = 'view:dashboard',
  VIEW_SERVICES = 'view:services',
  CREATE_SERVICE = 'create:service',
  EDIT_SERVICE = 'edit:service',
  DELETE_SERVICE = 'delete:service',
  TOGGLE_SERVICE = 'toggle:service',
  TEST_CONNECTION = 'test:connection',
  MANAGE_RATE_LIMIT = 'manage:rate_limit',
  MANAGE_CANARY = 'manage:canary',
  MANAGE_CIRCUIT_BREAKER = 'manage:circuit_breaker',
  VIEW_CONFIG = 'view:config',
  ROLLBACK_CONFIG = 'rollback:config',
  VIEW_MONITORING = 'view:monitoring',
  VIEW_ALERTS = 'view:alerts',
  MANAGE_ALERTS = 'manage:alerts',
  VIEW_AUDIT_LOGS = 'view:audit_logs',
  VIEW_USERS = 'view:users',
  CREATE_USER = 'create:user',
  EDIT_USER = 'edit:user',
  DELETE_USER = 'delete:user',
  MANAGE_ROLES = 'manage:roles',
  VIEW_SETTINGS = 'view:settings',
  EDIT_SETTINGS = 'edit:settings',
  /** Register VPS / worker hosts for linking services (optional labelling). */
  MANAGE_NODES = 'manage:nodes'
}

export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'VIEWER'] as const
export type Role = (typeof ROLES)[number]

const LEGACY_ROLE_MAP: Record<string, Role> = {
  OPERATOR: 'DEVELOPER'
}

export function normalizeRole(role: string): Role {
  if (LEGACY_ROLE_MAP[role]) {
    return LEGACY_ROLE_MAP[role]
  }

  if ((ROLES as readonly string[]).includes(role)) {
    return role as Role
  }

  return 'VIEWER'
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission),
  ADMIN: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_SERVICES,
    Permission.CREATE_SERVICE,
    Permission.EDIT_SERVICE,
    Permission.DELETE_SERVICE,
    Permission.TOGGLE_SERVICE,
    Permission.TEST_CONNECTION,
    Permission.MANAGE_RATE_LIMIT,
    Permission.MANAGE_CANARY,
    Permission.MANAGE_CIRCUIT_BREAKER,
    Permission.VIEW_CONFIG,
    Permission.ROLLBACK_CONFIG,
    Permission.VIEW_MONITORING,
    Permission.VIEW_ALERTS,
    Permission.MANAGE_ALERTS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.VIEW_SETTINGS,
    Permission.MANAGE_NODES
  ],
  DEVELOPER: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_SERVICES,
    Permission.TEST_CONNECTION,
    Permission.VIEW_MONITORING,
    Permission.VIEW_ALERTS,
    Permission.VIEW_AUDIT_LOGS
  ],
  VIEWER: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_SERVICES,
    Permission.VIEW_MONITORING,
    Permission.VIEW_ALERTS
  ]
}

export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)].includes(permission)
}
