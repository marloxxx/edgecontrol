'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, Lock } from 'lucide-react'
import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { PermissionGate } from '@/components/PermissionGate'
import { useRole } from '@/contexts/RoleContext'

export default function Settings() {
  const { role } = useRole()
  const canModify = role === 'SUPER_ADMIN'
  const isReadOnly = role === 'ADMIN'

  return (
    <LayoutWithSidebar>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Configure system-wide settings and policies</p>
        </div>

        {/* Permission Notice */}
        {!canModify && (
          <Card className="border-amber-600/50 bg-amber-900/10">
            <CardContent className="pt-6 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-400">Limited Access</h3>
                <p className="text-amber-300/80 mt-1">
                  Your role ({role}) does not have permission to modify settings. Please contact a Super Admin.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isReadOnly && (
          <Card className="border-blue-600/50 bg-blue-900/10">
            <CardContent className="pt-6 flex items-start gap-4">
              <Lock className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-400">Read-Only Mode</h3>
                <p className="text-blue-300/80 mt-1">
                  You can view settings but cannot modify them. Contact a Super Admin to make changes.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* General Settings */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-foreground">Control Panel Name</label>
              <Input
                defaultValue="Traefik Control Plane"
                disabled={!canModify}
                className="mt-2 bg-slate-900 border-border text-foreground disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground">Environment</label>
              <Input
                defaultValue="Production"
                disabled={!canModify}
                className="mt-2 bg-slate-900 border-border text-foreground disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground">API Endpoint</label>
              <Input
                defaultValue="https://api.traefik.internal"
                disabled={!canModify}
                className="mt-2 bg-slate-900 border-border text-foreground disabled:opacity-50 font-mono text-sm"
              />
            </div>

            {canModify && (
              <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
                Save Changes
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Monitoring Thresholds */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Monitoring Thresholds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-foreground">
                High Latency Alert (ms)
              </label>
              <Input
                type="number"
                defaultValue="500"
                disabled={!canModify}
                className="mt-2 bg-slate-900 border-border text-foreground disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground">
                Error Rate Threshold (%)
              </label>
              <Input
                type="number"
                defaultValue="5"
                disabled={!canModify}
                className="mt-2 bg-slate-900 border-border text-foreground disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground">
                Health Check Interval (s)
              </label>
              <Input
                type="number"
                defaultValue="30"
                disabled={!canModify}
                className="mt-2 bg-slate-900 border-border text-foreground disabled:opacity-50"
              />
            </div>

            {canModify && (
              <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
                Update Thresholds
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-foreground">Email Notifications</label>
              <Input
                defaultValue="alerts@example.com"
                disabled={!canModify}
                className="mt-2 bg-slate-900 border-border text-foreground disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground">Slack Webhook</label>
              <Input
                defaultValue="https://hooks.slack.com/services/***"
                disabled={!canModify}
                className="mt-2 bg-slate-900 border-border text-foreground disabled:opacity-50 font-mono text-sm"
              />
            </div>

            {canModify && (
              <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
                Update Notifications
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <PermissionGate permission="edit:settings">
          <Card className="border-red-600/50 bg-red-900/10">
            <CardHeader>
              <CardTitle className="text-red-400">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-red-300/80">
                These actions are irreversible. Please proceed with caution.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  Reset All Services
                </Button>
                <Button
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  Clear All Alerts
                </Button>
                <Button
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 col-span-2"
                >
                  Restart System
                </Button>
              </div>
            </CardContent>
          </Card>
        </PermissionGate>
      </div>
    </LayoutWithSidebar>
  )
}
