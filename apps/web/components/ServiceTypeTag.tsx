'use client'

import { Badge } from '@/components/ui/badge'
import type { ServiceType } from '@/lib/types'

interface ServiceTypeTagProps {
  type: ServiceType
}

export function ServiceTypeTag({ type }: ServiceTypeTagProps) {
  const typeConfig: Record<ServiceType, { label: string; className: string }> = {
    api: {
      label: 'API',
      className: 'bg-blue-500/15 text-blue-300 border-blue-500/25 font-mono'
    },
    ai: {
      label: 'AI',
      className: 'bg-purple-500/15 text-purple-300 border-purple-500/25 font-mono'
    },
    ws: {
      label: 'WebSocket',
      className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25 font-mono'
    },
    web: {
      label: 'Web',
      className: 'bg-orange-500/15 text-orange-300 border-orange-500/25 font-mono'
    },
    worker: {
      label: 'Worker',
      className: 'bg-slate-500/15 text-slate-300 border-slate-500/25 font-mono'
    }
  }

  const config = typeConfig[type]

  return (
    <Badge className={config.className} variant="outline">
      {config.label}
    </Badge>
  )
}
