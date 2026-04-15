'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { PermissionGate } from '@/components/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { trpc } from '@/src/lib/trpc'

export function NodesPage() {
  const listQuery = trpc.node.list.useQuery()
  const createMutation = trpc.node.create.useMutation({
    onSuccess: async () => {
      toast.success('Node registered')
      setName('')
      setHost('')
      setRegion('')
      await listQuery.refetch()
    },
    onError: (e) => toast.error(e.message)
  })

  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [region, setRegion] = useState('')

  const nodes = listQuery.data ?? []

  return (
    <LayoutWithSidebar>
      <div className="space-y-8 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nodes</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Register VPS or worker hosts here, then link services to them for clearer labelling. This does not change
            Traefik routing — upstream targets on each service still control where traffic goes.
          </p>
        </div>

        <PermissionGate permission="manage:nodes">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Add node</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="node-name">Display name</Label>
                  <Input
                    id="node-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="App VPS"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="node-host">Host / IP</Label>
                  <Input
                    id="node-host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="10.0.0.3"
                    className="h-9 font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="node-region">Region (optional)</Label>
                  <Input
                    id="node-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="eu-west"
                    className="h-9"
                  />
                </div>
              </div>
              <Button
                type="button"
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                disabled={createMutation.isPending || !name.trim() || !host.trim()}
                onClick={() =>
                  createMutation.mutate({
                    name: name.trim(),
                    host: host.trim(),
                    region: region.trim() === '' ? null : region.trim()
                  })
                }
              >
                {createMutation.isPending ? 'Saving…' : 'Create node'}
              </Button>
            </CardContent>
          </Card>
        </PermissionGate>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Registered nodes ({nodes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {listQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Region</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.name}</TableCell>
                      <TableCell className="font-mono text-sm">{n.host}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{n.region ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {nodes.length === 0 && !listQuery.isLoading ? (
              <p className="text-sm text-muted-foreground mt-2">No nodes yet. Admins can add one above.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  )
}
