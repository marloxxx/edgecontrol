'use client'

import { ReactNode } from 'react'

import type { Permission } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'

interface PermissionGateProps {
  permission: Permission
  children: ReactNode
}

export function PermissionGate({ permission, children }: PermissionGateProps) {
  const { hasPermission } = useAuth()

  if (!hasPermission(permission)) {
    return null
  }

  return <>{children}</>
}
