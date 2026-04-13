'use client'

import type { Permission } from '@/lib/types'

import { useAuth } from '@/contexts/AuthContext'

export function usePermission(permission: Permission): boolean {
  const { hasPermission } = useAuth()
  return hasPermission(permission)
}
