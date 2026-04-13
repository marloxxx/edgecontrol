import type { ReactNode } from 'react'

export interface ColumnDef<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  accessor?: (row: T) => string | number
  headerClassName?: string
  cellClassName?: string
}

export interface RowAction<T> {
  id: string
  label: string | ((row: T) => string)
  icon?: ReactNode
  onClick: (row: T) => void
  hidden?: (row: T) => boolean
  variant?: 'default' | 'destructive'
}

export interface FilterDef {
  id: string
  type: 'search' | 'select'
  placeholder?: string
  options?: { value: string; label: string }[]
  allValue?: string
}

export type IdentifiableRow = { id: string | number }

export interface DataTableProps<T extends IdentifiableRow> {
  data: T[]
  columns: ColumnDef<T>[]
  rowActions?: RowAction<T>[]
  filters?: FilterDef[]
  emptyMessage?: string
  itemsPerPage?: number
}
