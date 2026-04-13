'use client'

import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { trpc } from '@/src/lib/trpc'

export default function RoutesPage() {
  const servicesQuery = trpc.service.list.useQuery()

  const services = servicesQuery.data ?? []

  return (
    <LayoutWithSidebar>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Routes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generated Traefik host rules and upstream targets from registered services.
          </p>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Active routers ({services.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {servicesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading services…</p>
            ) : servicesQuery.isError ? (
              <p className="text-sm text-red-400">Could not load services.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Router</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.slice(0, 50).map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-mono">{service.name}</TableCell>
                      <TableCell className="font-mono">{`Host(\`${service.domain}\`)`}</TableCell>
                      <TableCell>{service.name}</TableCell>
                      <TableCell className="font-mono">
                        {service.targetHost}:{service.targetPort}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  )
}
