'use client'
import { CheckCircle2, RotateCcw } from 'lucide-react'

import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { useRole } from '@/contexts/RoleContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trpc } from '@/src/lib/trpc'
import { DataTable, ModuleHeader, ModuleSummary } from '@/src/components/shared'
import type { ColumnDef, RowAction } from '@/src/components/shared'

export function AlertsPage() {
  const { hasPermission } = useRole()
  const alertQuery = trpc.alert.list.useQuery({ status: undefined }, { refetchInterval: 10_000 })
  const ackMutation = trpc.alert.acknowledge.useMutation({
    onSuccess: async () => {
      await alertQuery.refetch()
    }
  })
  const resolveMutation = trpc.alert.resolve.useMutation({
    onSuccess: async () => {
      await alertQuery.refetch()
    }
  })
  const alerts = alertQuery.data ?? []

  const severityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'WARNING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'INFO':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'ACKNOWLEDGED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'RESOLVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      default:
        return ''
    }
  }

  const countByStatus = (status: string) => {
    if (status === 'all') return alerts.length
    return alerts.filter((alert) => alert.status === status.toUpperCase()).length
  }

  const tableRows = alerts

  const columns: ColumnDef<(typeof tableRows)[number]>[] = [
    {
      id: 'severity',
      header: 'Severity',
      accessor: (alert) => alert.severity,
      cell: (alert) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${severityBadgeClass(alert.severity)}`}>
          {alert.severity}
        </span>
      )
    },
    { id: 'serviceName', header: 'Service', accessor: (alert) => alert.serviceId, cell: (alert) => <span className="font-semibold text-cyan-400">{alert.service?.name ?? alert.serviceId}</span> },
    { id: 'message', header: 'Message', cell: (alert) => <span className="text-foreground text-sm">{alert.message}</span> },
    {
      id: 'status',
      header: 'Status',
      accessor: (alert) => alert.status,
      cell: (alert) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusBadgeClass(alert.status)}`}>
          {alert.status}
        </span>
      )
    },
    { id: 'createdAt', header: 'Created', cell: (alert) => <span className="text-sm text-muted-foreground">{new Date(alert.createdAt).toLocaleDateString()}</span> }
  ]

  const rowActions: RowAction<(typeof tableRows)[number]>[] = [
    {
      id: 'ack',
      label: (alert) => (alert.status === 'OPEN' ? 'Acknowledge' : 'Reopen'),
      icon: <CheckCircle2 className="mr-2 h-4 w-4" />,
      hidden: () => !hasPermission('manage:alerts'),
      onClick: async (alert) => {
        await ackMutation.mutateAsync({ id: alert.id })
      }
    },
    {
      id: 'resolve',
      label: (alert) => (alert.status === 'RESOLVED' ? 'Reopen' : 'Resolve'),
      icon: <RotateCcw className="mr-2 h-4 w-4" />,
      hidden: () => !hasPermission('manage:alerts'),
      onClick: async (alert) => {
        await resolveMutation.mutateAsync({ id: alert.id })
      }
    }
  ]

  return (
    <LayoutWithSidebar>
      <div className="space-y-8">
        <ModuleHeader title="Alerts" description="Monitor and manage service alerts" />

        <ModuleSummary
          items={[
            { label: 'Open', value: countByStatus('OPEN'), color: 'danger' },
            { label: 'Acknowledged', value: countByStatus('ACKNOWLEDGED'), color: 'warning' },
            { label: 'Resolved', value: countByStatus('RESOLVED'), color: 'accent' },
            { label: 'Total', value: countByStatus('all'), color: 'primary' }
          ]}
        />

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={tableRows}
              columns={columns}
              rowActions={rowActions}
              filters={[
                { id: 'search', type: 'search', placeholder: 'Search alert message or service...' },
                {
                  id: 'status',
                  type: 'select',
                  placeholder: 'Status',
                  allValue: 'all',
                  options: [
                    { value: 'all', label: 'All statuses' },
                    { value: 'OPEN', label: 'Open' },
                    { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
                    { value: 'RESOLVED', label: 'Resolved' }
                  ]
                }
              ]}
              emptyMessage="No alerts for this filter"
              itemsPerPage={10}
            />
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  )
}
