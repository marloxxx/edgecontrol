'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { createServiceSchema, type CreateServiceInput } from '@edgecontrol/trpc'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/src/lib/trpc'

const serviceFormSchema = createServiceSchema.omit({ tags: true, notes: true }).extend({
  tagsCsv: z.string().optional(),
  notes: z.string()
})

type FormValues = z.infer<typeof serviceFormSchema>

interface ServiceFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void | Promise<void>
}

const defaults: FormValues = {
  name: '',
  domain: '',
  targetHost: '',
  targetPort: 3000,
  protocol: 'http',
  type: 'api',
  enabled: true,
  weight: 100,
  healthPath: '/api/health',
  rateLimitAvg: null,
  rateLimitBurst: null,
  circuitBreakerEnabled: false,
  fallbackServiceId: null,
  tagsCsv: '',
  notes: '',
  nodeId: null,
  metricsEnabled: false,
  metricsPath: '/metrics',
  metricsPort: null
}

export function ServiceFormModal({ open, onOpenChange, onSuccess }: ServiceFormModalProps) {
  const nodesQuery = trpc.node.list.useQuery(undefined, { enabled: open })
  const createMutation = trpc.service.create.useMutation()

  const form = useForm<FormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: defaults
  })

  useEffect(() => {
    if (!open) {
      form.reset(defaults)
    }
  }, [open, form])

  const submit = form.handleSubmit(async (raw) => {
    const tags =
      raw.tagsCsv?.trim() === ''
        ? []
        : (raw.tagsCsv ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)

    const payload: CreateServiceInput = {
      name: raw.name,
      domain: raw.domain,
      targetHost: raw.targetHost,
      targetPort: raw.targetPort,
      protocol: raw.protocol,
      type: raw.type,
      enabled: raw.enabled,
      weight: raw.weight,
      healthPath: raw.healthPath,
      rateLimitAvg: raw.rateLimitAvg,
      rateLimitBurst: raw.rateLimitBurst,
      circuitBreakerEnabled: raw.circuitBreakerEnabled,
      fallbackServiceId: raw.fallbackServiceId,
      tags,
      notes: raw.notes === '' ? null : raw.notes,
      nodeId: raw.nodeId === '' || raw.nodeId === undefined ? null : raw.nodeId,
      metricsEnabled: raw.metricsEnabled,
      metricsPath: raw.metricsPath,
      metricsPort: raw.metricsPort ?? null
    }

    const parsed = createServiceSchema.safeParse(payload)
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Invalid form')
      return
    }

    try {
      await createMutation.mutateAsync(parsed.data)
      toast.success('Service created')
      onOpenChange(false)
      await onSuccess?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    }
  })

  const nodes = nodesQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base text-cyan-accent">Add service</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Name</Label>
            <Input id="svc-name" {...form.register('name')} required className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-domain">Public domain (Traefik Host)</Label>
            <Input id="svc-domain" placeholder="api.example.com" {...form.register('domain')} required className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="svc-host">Target host</Label>
              <Input id="svc-host" placeholder="10.0.0.3" {...form.register('targetHost')} required className="h-9 font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-port">Port</Label>
              <Input
                id="svc-port"
                type="number"
                {...form.register('targetPort', { valueAsNumber: true })}
                required
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5 w-full">
              <Label>Protocol</Label>
              <Select
                value={form.watch('protocol')}
                onValueChange={(v) => form.setValue('protocol', v as 'http' | 'https')}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="http">http</SelectItem>
                  <SelectItem value="https">https</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-full">
              <Label>Type</Label>
              <Select
                value={form.watch('type')}
                onValueChange={(v) =>
                  form.setValue('type', v as 'api' | 'ai' | 'ws' | 'web' | 'worker')
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                  <SelectItem value="ws">WebSocket</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="worker">Worker</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="svc-health">Health path</Label>
            <Input id="svc-health" {...form.register('healthPath')} className="h-9 font-mono text-sm" />
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Deployment node (optional)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Links this service to a record from <span className="font-mono text-foreground">Nodes</span> (a VPS or
              worker you registered). For labelling in the UI only; Traefik upstream remains the target host above.
            </p>
            <Select
              value={form.watch('nodeId') ?? '__none__'}
              onValueChange={(v) => form.setValue('nodeId', v === '__none__' ? null : v)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="No node" />
              </SelectTrigger>
              <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] max-w-[min(100vw-2rem,var(--radix-select-trigger-width))]">
                <SelectItem value="__none__">None</SelectItem>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name} ({n.host})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Prometheus (optional)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When enabled, the API updates the shared file_sd file so Prometheus scrapes{' '}
              <span className="font-mono">targetHost:port</span> on the private network (respecting your{' '}
              <span className="font-mono">/metrics</span> access rules).
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="svc-metrics-en"
                checked={form.watch('metricsEnabled')}
                onCheckedChange={(c) => form.setValue('metricsEnabled', c === true)}
              />
              <Label htmlFor="svc-metrics-en" className="text-sm font-normal cursor-pointer">
                Register for Prometheus scraping
              </Label>
            </div>
            {form.watch('metricsEnabled') ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="svc-mpath">Metrics path</Label>
                  <Input id="svc-mpath" {...form.register('metricsPath')} className="h-9 font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="svc-mport">Metrics port (optional)</Label>
                  <Input
                    id="svc-mport"
                    type="number"
                    placeholder="same as target"
                    value={form.watch('metricsPort') ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      form.setValue('metricsPort', v === '' ? null : Number.parseInt(v, 10))
                    }}
                    className="h-9"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="svc-tags">Tags (comma-separated)</Label>
            <Input id="svc-tags" {...form.register('tagsCsv')} placeholder="prod, team-a" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-notes">Notes</Label>
            <Textarea id="svc-notes" {...form.register('notes')} rows={2} className="text-sm resize-none" />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createMutation.isPending} className="text-white bg-cyan-600 hover:bg-cyan-700">
              {createMutation.isPending ? 'Saving…' : 'Create service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
