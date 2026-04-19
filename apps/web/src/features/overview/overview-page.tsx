'use client'

import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertCircle, CheckCircle, Server, XCircle } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { RoleBadge } from '@/components/RoleBadge'
import { ServiceTypeTag } from '@/components/ServiceTypeTag'
import { StatusBadge } from '@/components/StatusBadge'
import { VpsNodeTag } from '@/components/VpsNodeTag'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { trpc } from '@/src/lib/trpc'
import { ModuleHeader, StatCard } from '@/src/components/shared'
import { useAuth } from '@/contexts/AuthContext'
import type { ServiceStatus } from '@/lib/types'

type OperationalStatus = Exclude<ServiceStatus, 'DISABLED'>

function worstOperationalStatus(statuses: OperationalStatus[]): OperationalStatus {
  if (statuses.some((s) => s === 'DOWN')) return 'DOWN'
  if (statuses.some((s) => s === 'SLOW')) return 'SLOW'
  return 'UP'
}

function strokeForTopology(status: ServiceStatus): string {
  switch (status) {
    case 'DOWN':
      return '#b91c1c'
    case 'SLOW':
      return '#b45309'
    case 'DISABLED':
      return '#64748b'
    default:
      return '#047857'
  }
}

function layoutRowCentres(count: number, minY: number, maxY: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [(minY + maxY) / 2]
  const step = (maxY - minY) / (count - 1)
  return Array.from({ length: count }, (_, i) => minY + i * step)
}

export function OverviewPage() {
  const { user, role } = useAuth()
  const [clock, setClock] = useState(new Date())
  const summaryQuery = trpc.overview.summary.useQuery(undefined, { refetchInterval: 10_000 })
  const servicesQuery = trpc.service.list.useQuery()
  const healthQuery = trpc.health.getLatestAll.useQuery(undefined, { refetchInterval: 10_000 })
  const alertsQuery = trpc.alert.list.useQuery({ status: 'OPEN' }, { refetchInterval: 10_000 })
  const nodesQuery = trpc.node.list.useQuery()

  const summary = summaryQuery.data
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data])
  const health = useMemo(() => healthQuery.data ?? [], [healthQuery.data])
  const nodes = useMemo(() => nodesQuery.data ?? [], [nodesQuery.data])
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

  const chartData = useMemo(() => {
    return [...health]
      .filter((row) => row.enabled)
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName))
      .slice(0, 24)
      .map((row) => ({
        name: row.serviceName.length > 16 ? `${row.serviceName.slice(0, 15)}…` : row.serviceName,
        latency: Math.round(row.latencyMs)
      }))
  }, [health])

  const regionLabels = useMemo(() => {
    const labels = [...new Set(nodes.map((n) => (n.region?.trim() ? n.region.trim() : 'Unassigned')))].sort((a, b) =>
      a.localeCompare(b)
    )
    return labels.length ? labels : ['Unassigned']
  }, [nodes])

  const typeBuckets = useMemo(() => {
    const map = new Map<string, { enabled: boolean; status: string }[]>()
    for (const s of services) {
      const h = health.find((x) => x.serviceId === s.id)
      const type = (s.type || 'other').toLowerCase()
      if (!map.has(type)) map.set(type, [])
      map.get(type)!.push({ enabled: h?.enabled ?? true, status: h?.status ?? 'UP' })
    }
    const out: { type: string; displayStatus: ServiceStatus }[] = []
    for (const [type, rows] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const anyEnabled = rows.some((r) => r.enabled)
      if (!anyEnabled) {
        out.push({ type, displayStatus: 'DISABLED' })
        continue
      }
      const enabledRows = rows
        .filter((r) => r.enabled)
        .map((r) => r.status as OperationalStatus)
      out.push({ type, displayStatus: worstOperationalStatus(enabledRows) })
    }
    return out
  }, [services, health])

  const topologySvg = useMemo(() => {
    const hasWorkloads = services.length > 0 || nodes.length > 0
    if (!hasWorkloads) return null

    const maxRegions = 5
    const regions = regionLabels.slice(0, maxRegions)
    const regionOverflow = regionLabels.length - regions.length
    const maxTypes = 5
    const types = typeBuckets.slice(0, maxTypes)
    const typesOverflow = typeBuckets.length - types.length

    const regionYs = layoutRowCentres(regions.length, 70, 230)
    const typeYs = layoutRowCentres(types.length, 60, 240)

    const router = { x: 120, y: 150, w: 100, h: 60 }
    const regionX = 280
    const regionW = 100
    const regionH = 46
    const cluster = { x: 460, y: 125, w: 100, h: 50 }
    const endX = 640
    const endR = 24

    const lineStroke = 'hsl(var(--chart-grid))'
    const fillCard = 'hsl(var(--card))'
    const arrowFill = 'var(--color-cyan-accent)'

    const lines: ReactElement[] = []
    for (let i = 0; i < regions.length; i++) {
      const y = regionYs[i] ?? 150
      lines.push(
        <line
          key={`r-${i}`}
          x1={router.x + router.w}
          y1={router.y + router.h / 2}
          x2={regionX}
          y2={y}
          stroke={lineStroke}
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
        />
      )
    }
    lines.push(
      <line
        key="rc"
        x1={router.x + router.w}
        y1={router.y + router.h / 2}
        x2={cluster.x}
        y2={cluster.y + cluster.h / 2}
        stroke={lineStroke}
        strokeWidth={2}
        markerEnd="url(#arrowhead)"
      />
    )
    for (let i = 0; i < regions.length; i++) {
      const y = regionYs[i] ?? 150
      lines.push(
        <line
          key={`rc-${i}`}
          x1={regionX + regionW}
          y1={y}
          x2={cluster.x}
          y2={cluster.y + cluster.h / 2}
          stroke={lineStroke}
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
        />
      )
    }
    for (let i = 0; i < types.length; i++) {
      const y = typeYs[i] ?? 150
      lines.push(
        <line
          key={`ct-${i}`}
          x1={cluster.x + cluster.w}
          y1={cluster.y + cluster.h / 2}
          x2={endX - endR}
          y2={y}
          stroke={lineStroke}
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
        />
      )
    }

    return (
      <svg viewBox="0 0 720 300" className="w-full h-auto" style={{ minHeight: '300px' }}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill={arrowFill} />
          </marker>
        </defs>
        {lines}
        <rect
          x={router.x}
          y={router.y}
          width={router.w}
          height={router.h}
          rx={8}
          fill={fillCard}
          stroke="var(--color-cyan-accent)"
          strokeWidth={2}
        />
        <text
          x={router.x + router.w / 2}
          y={router.y + router.h / 2 + 5}
          textAnchor="middle"
          fill="hsl(var(--foreground))"
          className="text-xs font-mono"
        >
          Ingress
        </text>
        {regions.map((label, i) => {
          const y = (regionYs[i] ?? 150) - regionH / 2
          return (
            <g key={label + String(i)}>
              <rect
                x={regionX}
                y={y}
                width={regionW}
                height={regionH}
                rx={8}
                fill={fillCard}
                stroke="#047857"
                strokeWidth={2}
              />
              <text
                x={regionX + regionW / 2}
                y={y + regionH / 2 + 4}
                textAnchor="middle"
                fill="hsl(var(--foreground))"
                className="text-[11px] font-mono"
              >
                {label}
              </text>
            </g>
          )
        })}
        <rect
          x={cluster.x}
          y={cluster.y}
          width={cluster.w}
          height={cluster.h}
          rx={8}
          fill={fillCard}
          stroke="#6d28d9"
          strokeWidth={2}
        />
        <text
          x={cluster.x + cluster.w / 2}
          y={cluster.y + cluster.h / 2 + 4}
          textAnchor="middle"
          fill="hsl(var(--foreground))"
          className="text-[11px] font-mono"
        >
          Nodes ({nodes.length})
        </text>
        {types.map((bucket, i) => {
          const cy = typeYs[i] ?? 150
          const stroke = strokeForTopology(bucket.displayStatus)
          return (
            <g key={bucket.type + String(i)}>
              <circle cx={endX} cy={cy} r={endR} fill={fillCard} stroke={stroke} strokeWidth={2} />
              <text x={endX} y={cy + 4} textAnchor="middle" fill="hsl(var(--foreground))" className="text-[10px] font-mono uppercase">
                {bucket.type}
              </text>
            </g>
          )
        })}
        {(regionOverflow > 0 || typesOverflow > 0) && (
          <text x={360} y={288} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="text-[10px]">
            {regionOverflow > 0 ? `+${regionOverflow} regions ` : ''}
            {typesOverflow > 0 ? `+${typesOverflow} types` : ''}
          </text>
        )}
      </svg>
    )
  }, [regionLabels, typeBuckets, nodes.length, services.length])

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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Live Clock</p>
                <p className="font-mono text-sm text-foreground">{clock.toLocaleTimeString()}</p>
              </div>
              <div className="text-right space-y-1">
                <RoleBadge role={role} />
                <p className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">{user?.email ?? '—'}</p>
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
            <CardDescription>Regions from nodes, service types from workloads, borders reflect worst health per type.</CardDescription>
          </CardHeader>
          <CardContent>
            {topologySvg ?? (
              <p className="text-sm text-muted-foreground py-10 text-center">Add nodes or services to see a live topology sketch.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Latest latency by service</CardTitle>
              <CardDescription>Most recent probe per enabled service (ms).</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">No enabled services or no health data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" interval={0} angle={-35} textAnchor="end" height={70} tick={{ fontSize: 10 }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--chart-tooltip-bg))',
                        border: '1px solid hsl(var(--chart-tooltip-border))'
                      }}
                      labelStyle={{ color: 'hsl(var(--chart-tooltip-fg))' }}
                    />
                    <Line type="monotone" dataKey="latency" stroke="hsl(var(--chart-line-primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Active Alerts</CardTitle>
              <span className="text-sm font-semibold text-red-800">{recentAlerts.length}</span>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="p-3 rounded-lg bg-muted/40 border border-border/80">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-foreground text-sm">{alert.serviceName}</div>
                        <div className="text-xs text-muted-foreground mt-1">{alert.message}</div>
                      </div>
                      <div className="text-xs font-semibold text-red-800 ml-2">{alert.severity}</div>
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
                    const node = (service as { node?: { name: string } | null }).node
                    const rowStatus: ServiceStatus =
                      latest && !latest.enabled ? 'DISABLED' : ((latest?.status as OperationalStatus) ?? 'UP')
                    return (
                      <TableRow key={service.id} className="border-border hover:bg-muted/40">
                        <TableCell>
                          <Link to="/services/$id" params={{ id: service.id }}>
                            <Button variant="link" className="p-0 text-cyan-accent hover:opacity-80">
                              {service.name}
                            </Button>
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{service.domain}</TableCell>
                        <TableCell>
                          <ServiceTypeTag type={service.type} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={rowStatus} />
                        </TableCell>
                        <TableCell className="text-sm">-</TableCell>
                        <TableCell className="text-sm">{latest?.enabled === false ? '—' : `${latest?.latencyMs ?? 0}ms`}</TableCell>
                        <TableCell>
                          {node ? (
                            <VpsNodeTag label={node.name} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
