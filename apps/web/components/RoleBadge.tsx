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
      className: 'bg-slate-500/15 text-slate-300 border-slate-500/25'
    },
    DEVELOPER: {
      label: 'Developer',
      className: 'bg-blue-500/15 text-blue-300 border-blue-500/25'
    },
    ADMIN: {
      label: 'Admin',
      className: 'bg-purple-500/15 text-purple-300 border-purple-500/25'
    },
    SUPER_ADMIN: {
      label: 'Super Admin',
      className: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
    }
  }

  const config = roleConfig[role]

  return (
    <Badge className={config.className} variant="outline">
      {config.label}
    </Badge>
  )
}
