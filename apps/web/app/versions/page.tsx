'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { PermissionGate } from '@/components/PermissionGate'
import { CodeBlock } from '@/components/CodeBlock'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

import { trpc } from '@/src/lib/trpc'

export default function Versions() {
  const versionsQuery = trpc.config.getVersions.useQuery()
  const regenerateMutation = trpc.config.regenerate.useMutation({
    onSuccess: async () => {
      toast.success('New config version created')
      await versionsQuery.refetch()
    }
  })
  const rollbackMutation = trpc.config.rollback.useMutation({
    onSuccess: async () => {
      toast.success('Rollback applied successfully')
      await versionsQuery.refetch()
    }
  })
  const versions = versionsQuery.data ?? []
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null)
  const [previewVersion, setPreviewVersion] = useState<string | null>(null)

  return (
    <LayoutWithSidebar>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Versions</h1>
            <p className="text-muted-foreground mt-2">Manage and rollback configurations</p>
          </div>
          <PermissionGate permission="rollback:config">
            <Button
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              onClick={async () => {
                await regenerateMutation.mutateAsync()
              }}
            >
              Deploy New Version
            </Button>
          </PermissionGate>
        </div>

        {/* Timeline */}
        <div className="relative space-y-4">
          {versions.map((version, index) => (
            <div key={version.id} className="relative">
              {/* Timeline Line */}
              {index !== versions.length - 1 && (
                <div className="absolute left-6 top-16 w-0.5 h-12 bg-gradient-to-b from-cyan-400 to-transparent" />
              )}

              {/* Timeline Dot */}
              <div className="absolute left-2 top-2 w-9 h-9 bg-cyan-400/10 border-2 border-cyan-400 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-cyan-400 rounded-full" />
              </div>

              {/* Version Card */}
              <Card
                className={`ml-20 border-border bg-card cursor-pointer transition hover:border-cyan-400/50 ${
                  expandedVersion === version.id ? 'border-cyan-400/50' : ''
                }`}
                onClick={() => setExpandedVersion(expandedVersion === version.id ? null : version.id)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-sm font-mono font-bold text-cyan-400">{version.number}</div>
                        <div className="text-xs text-muted-foreground mt-1">{version.versionName}</div>
                      </div>
                      {version.isLive && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          LIVE
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          {new Date(version.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          by {version.createdBy}
                        </div>
                      </div>
                      {expandedVersion === version.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Expanded Content */}
                {expandedVersion === version.id && (
                  <CardContent className="border-t border-border pt-4 space-y-4">
                    {/* Metadata */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase">Created By</div>
                        <div className="text-foreground mt-1">{version.createdBy}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase">Services</div>
                          <div className="text-foreground mt-1">Snapshot available</div>
                        </div>
                      </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border flex-1"
                        onClick={() => setPreviewVersion(version.id)}
                      >
                        Preview YAML
                      </Button>
                      <PermissionGate permission="rollback:config">
                        {!version.isLive && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                            onClick={async () => {
                              await rollbackMutation.mutateAsync({ versionId: version.id })
                            }}
                          >
                            Deploy
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="border-border" onClick={async () => {
                          await rollbackMutation.mutateAsync({ versionId: version.id })
                        }}>
                          Rollback
                        </Button>
                      </PermissionGate>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          ))}
        </div>

        {/* Preview Modal */}
        {previewVersion && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="border-border bg-card w-full max-w-2xl max-h-96 overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card border-b border-border">
                <CardTitle>Version Preview</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewVersion(null)}
                  className="text-muted-foreground"
                >
                  ✕
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <CodeBlock
                  code={YAML.stringify(versions.find(v => v.id === previewVersion)?.configSnapshot || {})}
                  language="yaml"
                  title="traefik-config.yaml"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </LayoutWithSidebar>
  )
}

// Simple YAML stringifier
const YAML = {
  stringify: (obj: any, indent = 0): string => {
    const spaces = ' '.repeat(indent)
    let result = ''

    for (const key in obj) {
      const value = obj[key]
      if (Array.isArray(value)) {
        result += `${spaces}${key}:\n`
        value.forEach(item => {
          result += `${spaces}  - ${item}\n`
        })
      } else if (typeof value === 'object' && value !== null) {
        result += `${spaces}${key}:\n${YAML.stringify(value, indent + 2)}`
      } else {
        result += `${spaces}${key}: ${value}\n`
      }
    }

    return result
  }
}
