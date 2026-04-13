import { InboxIcon, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  message?: string
  onAdd?: () => void
  addLabel?: string
}

export function EmptyState({
  message = 'No data yet',
  onAdd,
  addLabel = 'Add data'
}: Readonly<EmptyStateProps>) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
        <InboxIcon size={28} className="text-muted-foreground/50" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground mt-1">Add records to start using this section</p>
      </div>
      {onAdd ? (
        <Button size="sm" className="gap-2 text-white bg-cyan-600 hover:bg-cyan-700" onClick={onAdd}>
          <Plus size={14} />
          {addLabel}
        </Button>
      ) : null}
    </div>
  )
}
