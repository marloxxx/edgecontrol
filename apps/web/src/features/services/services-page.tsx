'use client'

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Copy, Edit, PlugZap, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ServiceTypeTag } from '@/components/ServiceTypeTag'
import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRole } from '@/contexts/RoleContext'
import { trpc } from '@/src/lib/trpc'
import { DataTable, DeleteDialog, ModuleHeader, ServiceFormModal } from '@/src/components/shared'
import type { ColumnDef, RowAction } from '@/src/components/shared'

export function ServicesPage() {
  const { hasPermission } = useRole()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<{ id: string; name: string } | undefined>(undefined)
  const serviceQuery = trpc.service.list.useQuery()
  const deleteMutation = trpc.service.delete.useMutation({
    onSuccess: async () => {
      toast.success('Service deleted')
      await serviceQuery.refetch()
    }
  })
  const testConnectionMutation = trpc.service.testConnection.useMutation()
  const toggleMutation = trpc.service.toggle.useMutation({
    onSuccess: async () => {
      await serviceQuery.refetch()
    }
  })

  const services = serviceQuery.data ?? []

  const columns: ColumnDef<(typeof services)[number]>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (service) => (
        <Link to="/services/$id" params={{ id: service.id }}>
          <Button variant="link" className="h-auto p-0 font-semibold text-primary">
            {service.name}
          </Button>
        </Link>
      )
    },
    {
      id: 'domain',
      header: 'Domain',
      accessor: (service) => service.domain,
      cell: (service) => <span className="font-mono text-sm text-foreground/90">{service.domain}</span>
    },
    {
      id: 'type',
      header: 'Type',
      accessor: (service) => service.type,
      cell: (service) => <ServiceTypeTag type={service.type} />
    },
    {
      id: 'target',
      header: 'Target',
      cell: (service) => (
        <span className="font-mono text-sm text-foreground/90">
          {service.targetHost}:{service.targetPort}
        </span>
      )
    },
    {
      id: 'enabled',
      header: 'Enabled',
      accessor: (service) => String(service.enabled),
      cell: (service) => <div className={`inline-block w-3 h-3 rounded-full ${service.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
    }
  ]

  const rowActions: RowAction<(typeof services)[number]>[] = [
    {
      id: 'test',
      label: 'Test Connection',
      icon: <PlugZap className="mr-2 h-4 w-4" />,
      onClick: async (service) => {
        const result = await testConnectionMutation.mutateAsync({ id: service.id })
        toast.info(`${service.name}: ${result.status} (${result.latencyMs}ms)`)
      }
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: <Edit className="mr-2 h-4 w-4" />,
      hidden: () => !hasPermission('edit:service'),
      onClick: (service) => {
        setEditingServiceId(service.id)
        setIsFormOpen(true)
      }
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: <Copy className="mr-2 h-4 w-4" />,
      hidden: () => !hasPermission('create:service'),
      onClick: () => toast.info('Duplicate flow not implemented yet')
    },
    {
      id: 'toggle',
      label: (service) => (service.enabled ? 'Disable' : 'Enable'),
      hidden: () => !hasPermission('toggle:service'),
      onClick: async (service) => {
        await toggleMutation.mutateAsync({ id: service.id, enabled: !service.enabled })
      }
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      variant: 'destructive',
      hidden: () => !hasPermission('delete:service'),
      onClick: (service) => {
        setSelectedService({ id: service.id, name: service.name })
        setIsDeleteOpen(true)
      }
    }
  ]

  return (
    <LayoutWithSidebar>
      <div className="space-y-6 w-full">
        <ModuleHeader
          title="Services"
          description="Manage and monitor all your services"
          onAdd={
            hasPermission('create:service')
              ? () => {
                  setEditingServiceId(null)
                  setIsFormOpen(true)
                }
              : undefined
          }
          addLabel="Add Service"
        />

        <Card className="border-border bg-card w-full">
          <CardHeader>
            <CardTitle className="text-foreground">All Services ({services.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={services}
              columns={columns}
              rowActions={rowActions}
              filters={[
                { id: 'search', type: 'search', placeholder: 'Search services by name or domain...' },
                {
                  id: 'type',
                  type: 'select',
                  placeholder: 'Type',
                  allValue: 'all',
                  options: [
                    { value: 'all', label: 'All types' },
                    { value: 'api', label: 'API' },
                    { value: 'ai', label: 'AI' },
                    { value: 'ws', label: 'WS' },
                    { value: 'web', label: 'WEB' },
                    { value: 'worker', label: 'WORKER' }
                  ]
                },
                {
                  id: 'status',
                  type: 'select',
                  placeholder: 'Status',
                  allValue: 'all',
                  options: [
                    { value: 'all', label: 'All statuses' },
                    { value: 'UP', label: 'UP' },
                    { value: 'SLOW', label: 'SLOW' },
                    { value: 'DOWN', label: 'DOWN' }
                  ]
                }
              ]}
              emptyMessage="No matching services found"
            />
          </CardContent>
        </Card>
      </div>

      <ServiceFormModal
        open={isFormOpen}
        editServiceId={editingServiceId}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) setEditingServiceId(null)
        }}
        onSuccess={async () => {
          await serviceQuery.refetch()
        }}
      />
      <DeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        itemName={selectedService?.name}
        onConfirm={async () => {
          if (selectedService) {
            await deleteMutation.mutateAsync({ id: selectedService.id })
          }
          setSelectedService(undefined)
        }}
      />
    </LayoutWithSidebar>
  )
}
