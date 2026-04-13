'use client'

import { Badge } from '@/components/ui/badge'

interface VpsNodeTagProps {
  node: string
}

export function VpsNodeTag({ node }: VpsNodeTagProps) {
  return (
    <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/25 font-mono text-xs" variant="outline">
      {node}
    </Badge>
  )
}
