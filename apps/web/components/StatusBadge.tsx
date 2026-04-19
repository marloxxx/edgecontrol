'use client'

import { Badge } from '@/components/ui/badge'
import type { ServiceStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: ServiceStatus
  animate?: boolean
}

export function StatusBadge({ status, animate = false }: StatusBadgeProps) {
  const statusConfig = {
    UP: {
      label: 'UP',
      className: 'bg-emerald-500/12 text-emerald-800 border-emerald-500/35'
    },
    SLOW: {
      label: 'SLOW',
      className: 'bg-amber-500/12 text-amber-900 border-amber-500/35'
    },
    DOWN: {
      label: 'DOWN',
      className: 'bg-red-500/12 text-red-800 border-red-500/35'
    },
    DISABLED: {
      label: 'OFF',
      className: 'bg-muted text-muted-foreground border-border'
    }
  }

  const config = statusConfig[status]

  return (
    <Badge 
      className={`${config.className} ${animate ? (status === 'DOWN' ? 'animate-status-pulse-fast' : 'animate-status-pulse') : ''}`}
      variant="outline"
    >
      <span className="inline-block w-2 h-2 rounded-full mr-2 bg-current" />
      {config.label}
    </Badge>
  )
}
