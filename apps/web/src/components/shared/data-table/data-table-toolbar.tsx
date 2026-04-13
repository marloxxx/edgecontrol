'use client'

import { Filter, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import type { FilterDef } from './types'

interface DataTableToolbarProps {
  filters?: FilterDef[]
  filterValues: Record<string, string>
  onFilterChange: (id: string, value: string) => void
}

export function DataTableToolbar({ filters, filterValues, onFilterChange }: Readonly<DataTableToolbarProps>) {
  if (!filters || filters.length === 0) return null

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {filters.map((filter) => {
        if (filter.type === 'search') {
          return (
            <div key={filter.id} className="relative min-w-[220px] flex-1">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={filter.placeholder ?? 'Search...'}
                className="h-9 pl-9 text-sm"
                value={filterValues[filter.id] ?? ''}
                onChange={(event) => onFilterChange(filter.id, event.target.value)}
              />
            </div>
          )
        }

        if (filter.type === 'select' && filter.options) {
          const allValue = filter.allValue ?? 'all'
          return (
            <div key={filter.id} className="w-fit">
              <Select value={filterValues[filter.id] ?? allValue} onValueChange={(value) => onFilterChange(filter.id, value)}>
                <SelectTrigger className="h-9 w-44 gap-2 text-sm">
                  <Filter size={13} />
                  <SelectValue placeholder={filter.placeholder ?? 'Filter'} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}
