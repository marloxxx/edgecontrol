/**
 * Re-exports RBAC and auth hooks. Prefer importing from `@/contexts/AuthContext` or `@/lib/rbac`.
 */
export { PERMISSIONS, ROLE_PERMISSIONS } from '@/lib/rbac'
export { AuthProvider, useAuth, useRole } from '@/contexts/AuthContext'
