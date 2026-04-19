'use client'

import { Badge } from '@/components/ui/badge'
import type { Role } from '@/lib/types'

interface RoleBadgeProps {
  role: Role
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const roleConfig: Record<Role, { label: string; className: string }> = {
    VIEWER: {
      label: 'Viewer',
      className: 'bg-slate-500/12 text-slate-800 border-slate-500/30'
    },
    DEVELOPER: {
      label: 'Developer',
      className: 'bg-blue-500/12 text-blue-900 border-blue-500/30'
    },
    ADMIN: {
      label: 'Admin',
      className: 'bg-purple-500/12 text-purple-900 border-purple-500/30'
    },
    SUPER_ADMIN: {
      label: 'Super Admin',
      className: 'bg-cyan-muted text-cyan-accent border-cyan-border'
    }
  }

  const config = roleConfig[role]

  return (
    <Badge className={config.className} variant="outline">
      {config.label}
    </Badge>
  )
}
