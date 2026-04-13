'use client'

import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertCircle, CheckCircle, Server, XCircle } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { RoleBadge } from '@/components/RoleBadge'
import { ServiceTypeTag } from '@/components/ServiceTypeTag'
import { StatusBadge } from '@/components/StatusBadge'
import { VpsNodeTag } from '@/components/VpsNodeTag'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { trpc } from '@/src/lib/trpc'
import { ModuleHeader, StatCard } from '@/src/components/shared'
import { useAuth } from '@/contexts/AuthContext'

export function OverviewPage() {
  const { user, role } = useAuth()
  const [clock, setClock] = useState(new Date())
  const summaryQuery = trpc.overview.summary.useQuery(undefined, { refetchInterval: 10_000 })
  const servicesQuery = trpc.service.list.useQuery()
  const healthQuery = trpc.health.getLatestAll.useQuery(undefined, { refetchInterval: 10_000 })
  const alertsQuery = trpc.alert.list.useQuery({ status: 'OPEN' }, { refetchInterval: 10_000 })

  const summary = summaryQuery.data
  const services = servicesQuery.data ?? []
  const health = healthQuery.data ?? []
  const recentAlerts = alertsQuery.data?.slice(0, 5) ?? []
  const stats = [
    {
      title: 'Total Services',
      value: summary?.totalServices ?? services.length,
      icon: <Server className="h-5 w-5" />,
      variant: 'default' as const,
      trend: { value: 'Live from control plane', direction: 'up' as const }
    },
    {
      title: 'Online',
      value: summary?.upServices ?? 0,
      icon: <CheckCircle className="h-5 w-5" />,
      variant: 'accent' as const,
      trend: { value: 'Stable', direction: 'up' as const }
    },
    {
      title: 'Degraded',
      value: summary?.slowServices ?? 0,
      icon: <AlertCircle className="h-5 w-5" />,
      variant: 'warning' as const,
      trend: { value: 'Latency above threshold', direction: 'neutral' as const }
    },
    {
      title: 'Down',
      value: summary?.downServices ?? 0,
      icon: <XCircle className="h-5 w-5" />,
      variant: 'danger' as const,
      trend: { value: 'Immediate action needed', direction: 'down' as const }
    }
  ]

  const chartData = health.slice(0, 20).map((check, index) => ({
    name: `${index}m ago`,
    latency: Math.round(check.latencyMs)
  }))

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <LayoutWithSidebar>
      <div className="space-y-6 w-full">
        <ModuleHeader
          title="Overview"
          description="System health and real-time metrics"
          trailing={
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Live Clock</p>
                <p className="font-mono text-sm text-zinc-300">{clock.toLocaleTimeString()}</p>
              </div>
              <div className="text-right space-y-1">
                <RoleBadge role={role} />
                <p className="text-xs font-mono text-zinc-400 max-w-[200px] truncate">{user?.email ?? '—'}</p>
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {stats.map((stat, index) => (
            <StatCard key={index} title={stat.title} value={stat.value} icon={stat.icon} variant={stat.variant} trend={stat.trend} />
          ))}
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>VPS Topology</CardTitle>
          </CardHeader>
          <CardContent>
            <svg viewBox="0 0 800 300" className="w-full h-auto" style={{ minHeight: '300px' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#00d4ff" />
                </marker>
              </defs>
              <line x1="150" y1="150" x2="300" y2="100" stroke="#262c38" strokeWidth="2" markerEnd="url(#arrowhead)" />
              <line x1="150" y1="150" x2="300" y2="150" stroke="#262c38" strokeWidth="2" markerEnd="url(#arrowhead)" />
              <line x1="150" y1="150" x2="300" y2="200" stroke="#262c38" strokeWidth="2" markerEnd="url(#arrowhead)" />
              <line x1="150" y1="150" x2="500" y2="150" stroke="#262c38" strokeWidth="2" markerEnd="url(#arrowhead)" />
              <rect x="100" y="120" width="100" height="60" rx="8" fill="#141419" stroke="#00d4ff" strokeWidth="2" />
              <text x="150" y="155" textAnchor="middle" className="text-xs fill-foreground font-mono">
                Router
              </text>
              <rect x="250" y="70" width="100" height="50" rx="8" fill="#141419" stroke="#10b981" strokeWidth="2" />
              <text x="300" y="100" textAnchor="middle" className="text-xs fill-foreground font-mono">
                US-East
              </text>
              <rect x="250" y="120" width="100" height="50" rx="8" fill="#141419" stroke="#10b981" strokeWidth="2" />
              <text x="300" y="150" textAnchor="middle" className="text-xs fill-foreground font-mono">
                US-West
              </text>
              <rect x="250" y="170" width="100" height="50" rx="8" fill="#141419" stroke="#10b981" strokeWidth="2" />
              <text x="300" y="200" textAnchor="middle" className="text-xs fill-foreground font-mono">
                EU
              </text>
              <rect x="450" y="120" width="100" height="50" rx="8" fill="#141419" stroke="#8b5cf6" strokeWidth="2" />
              <text x="500" y="150" textAnchor="middle" className="text-xs fill-foreground font-mono">
                Cluster
              </text>
              <circle cx="650" cy="80" r="25" fill="#141419" stroke="#ec4899" strokeWidth="2" />
              <text x="650" y="85" textAnchor="middle" className="text-xs fill-foreground font-mono">
                API
              </text>
              <circle cx="650" cy="150" r="25" fill="#141419" stroke="#f59e0b" strokeWidth="2" />
              <text x="650" y="155" textAnchor="middle" className="text-xs fill-foreground font-mono">
                Cache
              </text>
              <circle cx="650" cy="220" r="25" fill="#141419" stroke="#06b6d4" strokeWidth="2" />
              <text x="650" y="225" textAnchor="middle" className="text-xs fill-foreground font-mono">
                DB
              </text>
            </svg>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Latency Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262c38" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#141419', border: '1px solid #262c38' }} labelStyle={{ color: '#e4e4e7' }} />
                  <Line type="monotone" dataKey="latency" stroke="#00d4ff" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Active Alerts</CardTitle>
              <span className="text-sm font-semibold text-red-400">{recentAlerts.length}</span>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="p-3 rounded-lg bg-slate-900/50 border border-border/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-foreground text-sm">{alert.serviceName}</div>
                        <div className="text-xs text-muted-foreground mt-1">{alert.message}</div>
                      </div>
                      <div className="text-xs font-semibold text-red-400 ml-2">{alert.severity}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Service</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uptime</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>VPS Node</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.slice(0, 8).map((service) => {
                    const latest = health.find((value) => value.serviceId === service.id)
                    return (
                    <TableRow key={service.id} className="border-border hover:bg-slate-900/50">
                      <TableCell>
                        <Link to="/services/$id" params={{ id: service.id }}>
                          <Button variant="link" className="p-0 text-cyan-400 hover:text-cyan-300">
                            {service.name}
                          </Button>
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{service.domain}</TableCell>
                      <TableCell>
                        <ServiceTypeTag type={service.type} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={(latest?.status as 'UP' | 'SLOW' | 'DOWN') ?? 'UP'} />
                      </TableCell>
                      <TableCell className="text-sm">-</TableCell>
                      <TableCell className="text-sm">{latest?.latencyMs ?? 0}ms</TableCell>
                      <TableCell>
                        <VpsNodeTag node={service.targetHost} />
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <Link to="/services" className="mt-4 block">
              <Button variant="outline" className="border-border">
                View All Services →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  )
}
