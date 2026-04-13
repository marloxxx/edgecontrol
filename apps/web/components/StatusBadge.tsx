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
      className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    },
    SLOW: {
      label: 'SLOW',
      className: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    },
    DOWN: {
      label: 'DOWN',
      className: 'bg-red-500/15 text-red-300 border-red-500/30'
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
