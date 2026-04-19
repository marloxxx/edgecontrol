'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { StatusBadge } from '@/components/StatusBadge'
import { ServiceTypeTag } from '@/components/ServiceTypeTag'
import { VpsNodeTag } from '@/components/VpsNodeTag'
import { PermissionGate } from '@/components/PermissionGate'
import { CodeBlock } from '@/components/CodeBlock'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useRole } from '@/contexts/RoleContext'
import { useParams } from '@tanstack/react-router'
import type { ServiceStatus } from '@/lib/types'
import { trpc } from '@/src/lib/trpc'
import { ServiceFormModal } from '@/src/components/shared'

function parseDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

export default function ServiceDetail() {
  const { hasPermission } = useRole()
  const params = useParams({ strict: false })
  const serviceId = params.id as string

  const serviceQuery = trpc.service.getById.useQuery(
    { id: serviceId },
    { enabled: Boolean(serviceId) }
  )
  const healthQuery = trpc.health.getByService.useQuery(
    { serviceId, limit: 120 },
    { enabled: Boolean(serviceId) && serviceQuery.isSuccess && Boolean(serviceQuery.data) }
  )
  const auditQuery = trpc.audit.list.useQuery(
    { limit: 200 },
    { enabled: Boolean(serviceId) && serviceQuery.isSuccess && Boolean(serviceQuery.data) }
  )

  const service = serviceQuery.data
  const healthChecks = useMemo(() => healthQuery.data ?? [], [healthQuery.data])

  const latestStatus: ServiceStatus = useMemo(() => {
    const sorted = [...healthChecks].sort(
      (a, b) => parseDate(b.checkedAt).getTime() - parseDate(a.checkedAt).getTime()
    )
    return (sorted[0]?.status as ServiceStatus) ?? 'UP'
  }, [healthChecks])

  const avgLatencyMs = useMemo(() => {
    if (healthChecks.length === 0) return null
    const sum = healthChecks.reduce((acc, h) => acc + h.latencyMs, 0)
    return Math.round(sum / healthChecks.length)
  }, [healthChecks])

  const lastChecked = useMemo(() => {
    const sorted = [...healthChecks].sort(
      (a, b) => parseDate(b.checkedAt).getTime() - parseDate(a.checkedAt).getTime()
    )
    return sorted[0]?.checkedAt ? parseDate(sorted[0].checkedAt) : null
  }, [healthChecks])

  const chartData = useMemo(() => {
    const chronological = [...healthChecks].sort(
      (a, b) => parseDate(a.checkedAt).getTime() - parseDate(b.checkedAt).getTime()
    )
    return chronological.slice(-24).map((check, i) => ({
      name: `${i + 1}`,
      latency: check.latencyMs
    }))
  }, [healthChecks])

  const serviceAudit = useMemo(() => {
    if (!service) return []
    const prefix = `service:${service.name}`
    return (auditQuery.data ?? []).filter((entry) => entry.target === prefix)
  }, [auditQuery.data, service])

  const [secondsSinceLastCheck, setSecondsSinceLastCheck] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  useEffect(() => {
    if (!lastChecked) return
    const tick = () => {
      setSecondsSinceLastCheck(Math.max(0, Math.round((Date.now() - lastChecked.getTime()) / 1000)))
    }
    tick()
    const id = globalThis.setInterval(tick, 1000)
    return () => globalThis.clearInterval(id)
  }, [lastChecked])

  const canManageConfig = hasPermission('manage:rate_limit')

  if (serviceQuery.isLoading) {
    return (
      <LayoutWithSidebar>
        <div className="flex items-center justify-center h-96 gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading service…
        </div>
      </LayoutWithSidebar>
    )
  }

  if (serviceQuery.isError || !service) {
    return (
      <LayoutWithSidebar>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-foreground text-lg">Service not found</p>
            <p className="text-muted-foreground text-sm mt-2">
              {serviceQuery.error?.message ?? 'Unable to load this service.'}
            </p>
          </div>
        </div>
      </LayoutWithSidebar>
    )
  }

  const createdAt = parseDate(service.createdAt)
  const yamlConfig = `name: ${service.name}
domain: ${service.domain}
target:
  host: ${service.targetHost}
  port: ${service.targetPort}
protocol: ${service.protocol}
type: ${service.type}
${(service as { node?: { name: string } | null }).node ? `node: ${(service as { node: { name: string } }).node.name}` : ''}
health_check:
  path: ${service.healthPath}
  traefik_lb_probe: ${(service as { traefikHealthCheck?: boolean }).traefikHealthCheck !== false}
enabled: ${service.enabled}
metrics:
  enabled: ${(service as { metricsEnabled?: boolean }).metricsEnabled ?? false}
  path: ${(service as { metricsPath?: string }).metricsPath ?? '/metrics'}
  port: ${(service as { metricsPort?: number | null }).metricsPort ?? 'same as target'}
${service.rateLimitAvg != null && service.rateLimitBurst != null ? `rate_limit:\n  avg: ${service.rateLimitAvg}\n  burst: ${service.rateLimitBurst}` : ''}
circuit_breaker:
  enabled: ${service.circuitBreakerEnabled}
  status: ${service.circuitBreakerStatus}`

  return (
    <LayoutWithSidebar>
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{service.name}</h1>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <StatusBadge status={latestStatus} animate />
              <ServiceTypeTag type={service.type} />
              {service.node ? <VpsNodeTag label={service.node.name} /> : null}
            </div>
          </div>
          <div className="flex gap-2">
            <PermissionGate permission="edit:service">
              <Button type="button" variant="outline" className="border-border" onClick={() => setEditOpen(true)}>
                Edit Service
              </Button>
            </PermissionGate>
            <PermissionGate permission="delete:service">
              <Button variant="destructive">Delete Service</Button>
            </PermissionGate>
          </div>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Public Domain</div>
                <div className="font-mono text-lg text-foreground mt-1">{service.domain}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Target</div>
                <div className="font-mono text-lg text-foreground mt-1">
                  {service.targetHost}:{service.targetPort}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Observed status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground capitalize">{latestStatus.toLowerCase()}</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg latency (sample)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {avgLatencyMs != null ? `${avgLatencyMs}ms` : '—'}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Checks recorded</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{healthChecks.length}</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last check</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold text-foreground">
                {lastChecked ? `${secondsSinceLastCheck}s ago` : '—'}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-card border-b border-border rounded-none">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="audit">Audit History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Service information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Protocol</div>
                    <div className="font-mono text-foreground mt-1">{service.protocol.toUpperCase()}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Health path</div>
                    <div className="font-mono text-foreground mt-1">{service.healthPath}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Rate limit</div>
                    <div className="font-mono text-foreground mt-1">
                      {service.rateLimitAvg != null && service.rateLimitBurst != null
                        ? `${service.rateLimitAvg} avg / ${service.rateLimitBurst} burst`
                        : 'Not set'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Created</div>
                    <div className="font-mono text-foreground mt-1">{createdAt.toLocaleDateString()}</div>
                  </div>
                  {service.notes ? (
                    <div className="col-span-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase">Notes</div>
                      <div className="text-foreground mt-1">{service.notes}</div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Circuit breaker</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Enabled</span>
                    <span
                      className={`font-semibold ${service.circuitBreakerEnabled ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {service.circuitBreakerEnabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-semibold text-foreground">{service.circuitBreakerStatus}</span>
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <PermissionGate permission="manage:circuit_breaker">
                      <Button size="sm" variant="outline" className="border-border">
                        Force open
                      </Button>
                      <Button size="sm" variant="outline" className="border-border">
                        Force close
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Latency trend (recent samples)</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No health checks yet. They will appear after the worker records probes.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--chart-tooltip-bg))',
                          border: '1px solid hsl(var(--chart-tooltip-border))'
                        }}
                        labelStyle={{ color: 'hsl(var(--chart-tooltip-fg))' }}
                      />
                      <Line type="monotone" dataKey="latency" stroke="var(--brand-secondary)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Recent health checks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Latency</TableHead>
                        <TableHead>Status code</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {healthChecks.slice(0, 10).map((check) => (
                        <TableRow key={check.id} className="border-border hover:bg-muted/30">
                          <TableCell className="text-sm text-muted-foreground">
                            {parseDate(check.checkedAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={check.status as ServiceStatus} />
                          </TableCell>
                          <TableCell className="font-semibold">{check.latencyMs}ms</TableCell>
                          <TableCell className="font-mono">{check.statusCode ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            {canManageConfig ? (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Service configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={yamlConfig} language="yaml" title="traefik-config.yaml" />
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border bg-card border-amber-600/50 bg-amber-950/20">
                <CardHeader>
                  <CardTitle className="text-amber-400">Configuration lock</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-amber-200 text-sm">
                    Insufficient permissions to manage config. Ask an Admin for elevated access.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Audit log</CardTitle>
              </CardHeader>
              <CardContent>
                {auditQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading audit entries…</p>
                ) : serviceAudit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No audit entries for this service yet.</p>
                ) : (
                  <div className="space-y-3">
                    {serviceAudit.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-lg bg-muted/20 border-l-2 border-secondary"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-foreground">{entry.action}</div>
                            <div className="text-xs text-muted-foreground mt-1">By {entry.actor}</div>
                          </div>
                          <div className="text-sm text-muted-foreground whitespace-nowrap">
                            {parseDate(entry.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ServiceFormModal
        open={editOpen}
        editServiceId={serviceId}
        onOpenChange={setEditOpen}
        onSuccess={async () => {
          await serviceQuery.refetch()
          await healthQuery.refetch()
          await auditQuery.refetch()
        }}
      />
    </LayoutWithSidebar>
  )
}
