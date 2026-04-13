'use client'

import { Fragment } from 'react'
import { MoreVertical } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import type { RowAction } from './types'

interface RowActionsMenuProps<T> {
  row: T
  actions: RowAction<T>[]
}

export function RowActionsMenu<T>({ row, actions }: Readonly<RowActionsMenuProps<T>>) {
  const visible = actions.filter((action) => !action.hidden?.(row))
  if (visible.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Row actions">
          <MoreVertical size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 text-sm">
        {visible.map((action, index) => (
          <Fragment key={action.id}>
            {index > 0 ? <div className="my-1 h-px bg-border" /> : null}
            <DropdownMenuItem
              className={action.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
              onClick={() => action.onClick(row)}
            >
              {action.icon}
              {typeof action.label === 'function' ? action.label(row) : action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
