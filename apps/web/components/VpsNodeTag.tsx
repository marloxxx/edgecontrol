'use client'

import { Badge } from '@/components/ui/badge'

interface VpsNodeTagProps {
  /** Display label (e.g. node name from the Nodes registry). */
  label: string
}

export function VpsNodeTag({ label }: VpsNodeTagProps) {
  return (
    <Badge className="bg-slate-500/12 text-slate-800 border-slate-500/30 font-mono text-xs" variant="outline">
      {label}
    </Badge>
  )
}
