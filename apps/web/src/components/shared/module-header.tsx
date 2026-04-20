'use client'

import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ModuleHeaderProps {
  title: string
  description?: string
  onAdd?: () => void
  addLabel?: string
  trailing?: ReactNode
}

export function ModuleHeader({
  title,
  description,
  onAdd,
  addLabel = 'Add item',
  trailing
}: Readonly<ModuleHeaderProps>) {
  const hasActions = trailing != null || onAdd != null

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
      </div>
      {hasActions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-end">
          {trailing}
          {onAdd ? (
            <Button className="h-9 flex-shrink-0 gap-2 text-white bg-cyan-600 hover:bg-cyan-700" onClick={onAdd}>
              <Plus size={14} />
              {addLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
