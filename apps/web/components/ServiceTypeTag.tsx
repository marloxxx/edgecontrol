'use client'

import { Badge } from '@/components/ui/badge'
import type { ServiceType } from '@/lib/types'

interface ServiceTypeTagProps {
  type: ServiceType | string
}

const typeConfig: Record<ServiceType, { label: string; className: string }> = {
  api: {
    label: 'API',
    className: 'bg-blue-500/12 text-blue-900 border-blue-500/30 font-mono'
  },
  ai: {
    label: 'AI',
    className: 'bg-purple-500/12 text-purple-900 border-purple-500/30 font-mono'
  },
  ws: {
    label: 'WebSocket',
    className: 'bg-emerald-500/12 text-emerald-900 border-emerald-500/30 font-mono'
  },
  web: {
    label: 'Web',
    className: 'bg-orange-500/12 text-orange-900 border-orange-500/30 font-mono'
  },
  worker: {
    label: 'Worker',
    className: 'bg-slate-500/12 text-slate-800 border-slate-500/30 font-mono'
  }
}

export function ServiceTypeTag({ type }: ServiceTypeTagProps) {
  const key = (type as ServiceType) in typeConfig ? (type as ServiceType) : null
  const config = key
    ? typeConfig[key]
    : {
        label: String(type).toUpperCase(),
        className: 'bg-muted text-foreground border-border font-mono'
      }

  return (
    <Badge className={config.className} variant="outline">
      {config.label}
    </Badge>
  )
}
