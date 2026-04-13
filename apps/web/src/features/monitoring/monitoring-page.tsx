'use client'

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Line, LineChart, ResponsiveContainer } from 'recharts'

import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { trpc } from '@/src/lib/trpc'
import { ModuleHeader } from '@/src/components/shared'

export function MonitoringPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const healthQuery = trpc.health.getLatestAll.useQuery(undefined, {
    refetchInterval: 10_000
  })
  const servicesQuery = trpc.service.list.useQuery()

  const healthRows = healthQuery.data ?? []
  const services = servicesQuery.data ?? []
  const mergedServices = services.map((service) => {
    const check = healthRows.find((row) => row.serviceId === service.id)
    return {
      ...service,
      status: check?.status ?? 'UP',
      latencyMs: check?.latencyMs ?? 0
    }
  })
  const filteredServices = statusFilter
    ? mergedServices.filter((service) => service.status === statusFilter)
    : mergedServices

  const chartData = mergedServices.slice(0, 20).map((service, index) => ({
    name: index,
    latency: Math.max(40, service.latencyMs || 40 + (index % 5) * 12)
  }))

  return (
    <LayoutWithSidebar>
      <div className="space-y-8">
        <ModuleHeader title="Monitoring" description="Real-time service health and metrics" />

        <div className="flex gap-3">
          <Button variant={statusFilter === null ? 'default' : 'outline'} onClick={() => setStatusFilter(null)} className={statusFilter === null ? 'bg-cyan-600' : 'border-border'}>
            All Services ({mergedServices.length})
          </Button>
          <Button variant={statusFilter === 'SLOW' ? 'default' : 'outline'} onClick={() => setStatusFilter('SLOW')} className={statusFilter === 'SLOW' ? 'bg-amber-600' : 'border-border'}>
            Degraded ({mergedServices.filter((service) => service.status === 'SLOW').length})
          </Button>
          <Button variant={statusFilter === 'DOWN' ? 'default' : 'outline'} onClick={() => setStatusFilter('DOWN')} className={statusFilter === 'DOWN' ? 'bg-red-600' : 'border-border'}>
            Down ({mergedServices.filter((service) => service.status === 'DOWN').length})
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <Link key={service.id} to="/services/$id" params={{ id: service.id }}>
              <div className="bg-card border border-border rounded-lg p-6 hover:border-cyan-400/50 transition cursor-pointer h-full">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{service.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{service.domain}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={service.status} animate />
                  </div>
                </div>

                <div className="mb-4 h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <Line type="monotone" dataKey="latency" stroke="#00d4ff" dot={false} isAnimationActive={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Latency</span>
                    <span className="font-semibold text-foreground">{service.latencyMs}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Protocol</span>
                    <span className="font-semibold text-foreground">{service.protocol.toUpperCase()}</span>
                  </div>
                </div>

                <Button className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700 text-white text-sm">View Details →</Button>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </LayoutWithSidebar>
  )
}
