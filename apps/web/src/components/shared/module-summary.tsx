import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SummaryItem {
  label: string
  value: number | string
  color?: 'primary' | 'secondary' | 'accent' | 'warning' | 'danger'
}

interface ModuleSummaryProps {
  items: SummaryItem[]
}

const colorMap: Record<NonNullable<SummaryItem['color']>, { value: string }> = {
  primary: { value: 'text-cyan-accent' },
  secondary: { value: 'text-foreground' },
  accent: { value: 'text-emerald-800' },
  warning: { value: 'text-amber-800' },
  danger: { value: 'text-red-800' }
}

export function ModuleSummary({ items }: ModuleSummaryProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map((item, index) => {
        const style = colorMap[item.color ?? 'primary']
        return (
          <Card key={index} className="rounded-xl shadow-sm border border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className={cn('text-2xl font-bold font-mono', style.value)}>{item.value}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
