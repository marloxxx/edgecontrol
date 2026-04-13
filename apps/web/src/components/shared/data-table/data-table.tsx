'use client'

import { useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef as TanstackColumnDef } from '@tanstack/react-table'

import { EmptyState } from '@/src/components/shared/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { DataTablePagination } from './data-table-pagination'
import { DataTableToolbar } from './data-table-toolbar'
import { RowActionsMenu } from './row-actions-menu'
import type { DataTableProps, FilterDef, IdentifiableRow } from './types'

function buildInitialFilters(filters?: FilterDef[]) {
  const initial: Record<string, string> = {}
  for (const filter of filters ?? []) {
    initial[filter.id] = filter.type === 'select' ? filter.allValue ?? 'all' : ''
  }
  return initial
}

export function DataTable<T extends IdentifiableRow>({
  data,
  columns,
  rowActions,
  filters,
  emptyMessage = 'No rows found',
  itemsPerPage = 8
}: Readonly<DataTableProps<T>>) {
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => buildInitialFilters(filters))
  const [pageIndex, setPageIndex] = useState(0)

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      return (filters ?? []).every((filter) => {
        const value = filterValues[filter.id] ?? ''
        if (!value || value === 'all') return true
        if (filter.type === 'search') {
          return Object.values(row).join(' ').toLowerCase().includes(value.toLowerCase())
        }
        return String((row as Record<string, unknown>)[filter.id] ?? '').toLowerCase() === value.toLowerCase()
      })
    })
  }, [data, filterValues, filters])

  const tableColumns = useMemo<TanstackColumnDef<T>[]>(() => {
    const mapped: TanstackColumnDef<T>[] = columns.map((column) => ({
      id: column.id,
      header: () => column.header,
      cell: ({ row }) => column.cell(row.original),
      meta: { headerClassName: column.headerClassName, cellClassName: column.cellClassName }
    }))
    if (rowActions && rowActions.length > 0) {
      mapped.push({
        id: '__actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <RowActionsMenu row={row.original} actions={rowActions} />,
        meta: { headerClassName: 'w-[56px] pr-4 text-right', cellClassName: 'pr-4 text-right' }
      })
    }
    return mapped
  }, [columns, rowActions])

  const table = useReactTable({
    data: filteredData,
    columns: tableColumns,
    state: {
      pagination: {
        pageIndex,
        pageSize: itemsPerPage
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater({ pageIndex, pageSize: itemsPerPage }) : updater
      setPageIndex(next.pageIndex)
    }
  })

  const totalPages = Math.max(table.getPageCount(), 1)
  const currentPage = Math.min(pageIndex + 1, totalPages)

  return (
    <div className="space-y-4">
      <DataTableToolbar
        filters={filters}
        filterValues={filterValues}
        onFilterChange={(id, value) => {
          setPageIndex(0)
          setFilterValues((prev) => ({ ...prev, [id]: value }))
        }}
      />

      <div className={cn('overflow-hidden rounded-xl border border-border bg-card')}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as { headerClassName?: string } | undefined
                  return (
                    <TableHead key={header.id} className={meta?.headerClassName}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={table.getAllLeafColumns().length} className="py-10 text-center">
                  <EmptyState message={emptyMessage} />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/20">
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { cellClassName?: string } | undefined
                    return (
                      <TableCell key={cell.id} className={meta?.cellClassName}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredData.length}
        itemsPerPage={itemsPerPage}
        onPageChange={(page) => setPageIndex(Math.max(page - 1, 0))}
      />
    </div>
  )
}
