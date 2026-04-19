'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  createServiceSchema,
  updateServiceSchema,
  type CreateServiceInput
} from '@edgecontrol/trpc'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
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

type ServiceRecord = {
  name: string
  domain: string
  targetHost: string
  targetPort: number
  protocol: string
  type: string
  enabled: boolean
  weight: number
  healthPath: string
  rateLimitAvg: number | null
  rateLimitBurst: number | null
  circuitBreakerEnabled: boolean
  fallbackServiceId: string | null
  tags: string[]
  notes: string | null
  nodeId?: string | null
  metricsEnabled?: boolean
  metricsPath?: string
  metricsPort?: number | null
}

function serviceToFormValues(s: ServiceRecord): FormValues {
  return {
    name: s.name,
    domain: s.domain,
    targetHost: s.targetHost,
    targetPort: s.targetPort,
    protocol: (s.protocol === 'https' ? 'https' : 'http') as 'http' | 'https',
    type: (['api', 'ai', 'ws', 'web', 'worker'].includes(s.type) ? s.type : 'api') as FormValues['type'],
    enabled: s.enabled,
    weight: s.weight,
    healthPath: s.healthPath,
    rateLimitAvg: s.rateLimitAvg,
    rateLimitBurst: s.rateLimitBurst,
    circuitBreakerEnabled: s.circuitBreakerEnabled,
    fallbackServiceId: s.fallbackServiceId,
    tagsCsv: Array.isArray(s.tags) ? s.tags.join(', ') : '',
    notes: s.notes ?? '',
    nodeId: s.nodeId ?? null,
    metricsEnabled: Boolean(s.metricsEnabled),
    metricsPath: s.metricsPath ?? '/metrics',
    metricsPort: s.metricsPort ?? null
  }
}

interface ServiceFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void | Promise<void>
  /** When set, the dialog edits this service instead of creating a new one */
  editServiceId?: string | null
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

export function ServiceFormModal({ open, onOpenChange, onSuccess, editServiceId }: ServiceFormModalProps) {
  const isEdit = Boolean(editServiceId)
  const nodesQuery = trpc.node.list.useQuery(undefined, { enabled: open })
  const serviceQuery = trpc.service.getById.useQuery(
    { id: editServiceId! },
    { enabled: open && Boolean(editServiceId) }
  )

  const createMutation = trpc.service.create.useMutation()
  const updateMutation = trpc.service.update.useMutation()

  const form = useForm<FormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: defaults
  })

  useEffect(() => {
    if (!open) {
      form.reset(defaults)
      return
    }
    if (editServiceId && serviceQuery.data) {
      form.reset(serviceToFormValues(serviceQuery.data as ServiceRecord))
      return
    }
    if (!editServiceId) {
      form.reset(defaults)
    }
  }, [open, editServiceId, serviceQuery.data, form])

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

    try {
      if (editServiceId) {
        const parsed = updateServiceSchema.safeParse({ id: editServiceId, ...payload })
        if (!parsed.success) {
          toast.error(parsed.error.errors[0]?.message ?? 'Invalid form')
          return
        }
        await updateMutation.mutateAsync(parsed.data)
        toast.success('Service updated')
      } else {
        const parsed = createServiceSchema.safeParse(payload)
        if (!parsed.success) {
          toast.error(parsed.error.errors[0]?.message ?? 'Invalid form')
          return
        }
        await createMutation.mutateAsync(parsed.data)
        toast.success('Service created')
      }
      onOpenChange(false)
      await onSuccess?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : isEdit ? 'Update failed' : 'Create failed')
    }
  })

  const nodes = nodesQuery.data ?? []
  const editLoading = Boolean(editServiceId) && open && (serviceQuery.isLoading || serviceQuery.isFetching)
  const editError = Boolean(editServiceId) && open && serviceQuery.isError

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base text-cyan-accent">{isEdit ? 'Edit service' : 'Add service'}</DialogTitle>
        </DialogHeader>

        {editError ? (
          <p className="text-sm text-destructive py-4">
            {serviceQuery.error?.message ?? 'Could not load this service for editing.'}
          </p>
        ) : editLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading service…
          </div>
        ) : (
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
                <Label htmlFor="svc-port">Target port</Label>
                <Input
                  id="svc-port"
                  type="number"
                  {...form.register('targetPort', { valueAsNumber: true })}
                  required
                  className="h-9"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This is the upstream your app listens on <span className="font-medium text-foreground">inside the private network</span> (for
              example <span className="font-mono">10.3.1.156:80</span> or <span className="font-mono">:443</span>). Public traffic reaches your
              hostname on Traefik’s public entrypoints (usually 80/443); Traefik then forwards to this target. You do not add extra rows here
              only for public 80/443 — use one service per public hostname; set the port to whatever the private app actually uses (80, 443,
              8080, etc.).
            </p>
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
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="text-white bg-cyan-600 hover:bg-cyan-700"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving…'
                  : isEdit
                    ? 'Save changes'
                    : 'Create service'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
