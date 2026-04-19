import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatCardVariant = 'default' | 'warning' | 'danger' | 'accent'

type Trend = {
  value: string
  direction: 'up' | 'down' | 'neutral'
}

type StatCardProps = {
  title: string
  value: string | number
  icon: ReactNode
  trend?: Trend
  variant?: StatCardVariant
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  variant = 'default'
}: Readonly<StatCardProps>) {
  const variants: Record<StatCardVariant, { border: string; icon: string; value: string }> = {
    default: {
      border: 'border-l-[3px] border-l-cyan-accent',
      icon: 'bg-cyan-muted text-cyan-accent border border-cyan-border',
      value: 'text-cyan-accent'
    },
    warning: {
      border: 'border-l-[3px] border-l-amber-500',
      icon: 'bg-amber-500/12 text-amber-800 border border-amber-500/30',
      value: 'text-amber-800'
    },
    danger: {
      border: 'border-l-[3px] border-l-red-500',
      icon: 'bg-red-500/10 text-red-800 border border-red-500/25',
      value: 'text-red-800'
    },
    accent: {
      border: 'border-l-[3px] border-l-emerald-500',
      icon: 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/25',
      value: 'text-emerald-800'
    }
  }

  let trendIcon = Minus
  let trendClassName = 'bg-muted text-muted-foreground'
  if (trend?.direction === 'up') {
    trendIcon = TrendingUp
    trendClassName = 'bg-emerald-500/10 text-emerald-800'
  } else if (trend?.direction === 'down') {
    trendIcon = TrendingDown
    trendClassName = 'bg-red-500/10 text-red-800'
  }
  const TrendIcon = trendIcon

  const style = variants[variant]

  return (
    <Card className={cn('overflow-hidden py-4 transition-all hover:translate-y-[-1px]', style.border)}>
      <CardContent className="px-4 py-0">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className={cn('text-3xl font-bold font-mono', style.value)}>{value}</p>
            {trend ? (
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]', trendClassName)}>
                <TrendIcon className="h-3 w-3" />
                {trend.value}
              </span>
            ) : null}
          </div>
          <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-lg', style.icon)}>{icon}</span>
        </div>
      </CardContent>
    </Card>
  )
}
