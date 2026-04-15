import { Permission, hasPermission as hasSharedPermission, normalizeRole, ROLE_PERMISSIONS as SHARED_ROLE_PERMISSIONS } from '@edgecontrol/trpc'

import type { Role } from '@/lib/types'

export const PERMISSIONS = {
  VIEW_SERVICES: Permission.VIEW_SERVICES,
  CREATE_SERVICE: Permission.CREATE_SERVICE,
  EDIT_SERVICE: Permission.EDIT_SERVICE,
  DELETE_SERVICE: Permission.DELETE_SERVICE,
  TOGGLE_SERVICE: Permission.TOGGLE_SERVICE,
  TEST_CONNECTION: Permission.TEST_CONNECTION,
  ROLLBACK_CONFIG: Permission.ROLLBACK_CONFIG,
  MANAGE_CIRCUIT_BREAKER: Permission.MANAGE_CIRCUIT_BREAKER,
  MANAGE_CANARY: Permission.MANAGE_CANARY,
  MANAGE_RATE_LIMIT: Permission.MANAGE_RATE_LIMIT,
  MANAGE_ALERTS: Permission.MANAGE_ALERTS,
  VIEW_USERS: Permission.VIEW_USERS,
  CREATE_USER: Permission.CREATE_USER,
  EDIT_USER: Permission.EDIT_USER,
  DELETE_USER: Permission.DELETE_USER,
  MANAGE_ROLES: Permission.MANAGE_ROLES,
  VIEW_SETTINGS: Permission.VIEW_SETTINGS,
  EDIT_SETTINGS: Permission.EDIT_SETTINGS,
  VIEW_MONITORING: Permission.VIEW_MONITORING,
  VIEW_ALERTS: Permission.VIEW_ALERTS,
  VIEW_AUDIT_LOGS: Permission.VIEW_AUDIT_LOGS,
  VIEW_DASHBOARD: Permission.VIEW_DASHBOARD,
  MANAGE_NODES: Permission.MANAGE_NODES
} as const

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = SHARED_ROLE_PERMISSIONS

export function mapApiRoleToUi(role: string | undefined): Role {
  return normalizeRole(role ?? 'VIEWER')
}

export function hasPermission(role: string, permission: Permission): boolean {
  return hasSharedPermission(role, permission)
}
