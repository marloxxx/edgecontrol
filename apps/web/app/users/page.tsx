'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, AlertCircle } from 'lucide-react'
import { LayoutWithSidebar } from '@/app/layout-with-sidebar'
import { RoleBadge } from '@/components/RoleBadge'
import { useAuth } from '@/contexts/AuthContext'

export default function Users() {
  const { hasPermission } = useAuth()
  const hasAccess = hasPermission('view:users')
  const canCreateUser = hasPermission('create:user')

  if (!hasAccess) {
    return (
      <LayoutWithSidebar>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Users</h1>
            <p className="text-muted-foreground mt-2">Manage team members and permissions</p>
          </div>

          <Card className="border-red-600/50 bg-red-900/10">
            <CardContent className="pt-6 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-400">Access Denied</h3>
                <p className="text-red-300/80 mt-1">
                  You do not have permission to view user management.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </LayoutWithSidebar>
    )
  }

  return (
    <LayoutWithSidebar>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Users</h1>
            <p className="text-muted-foreground mt-2">Manage team members and permissions</p>
          </div>
          <Button
            className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
            disabled={!canCreateUser}
          >
            <Plus className="w-4 h-4" />
            Add User
          </Button>
        </div>

        {/* Users Table */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Team Members (0)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Avatar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="w-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      There is no user listing API yet. Accounts are created via database seed or a future admin
                      endpoint; mock data has been removed in favour of live services data elsewhere.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Role Descriptions */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-900/30 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <RoleBadge role="VIEWER" />
                  <span className="text-sm text-muted-foreground">Read-only access</span>
                </div>
                <p className="text-sm text-foreground">View dashboards, services, and monitoring data. No modification permissions.</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/30 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <RoleBadge role="DEVELOPER" />
                  <span className="text-sm text-muted-foreground">Developer access</span>
                </div>
                <p className="text-sm text-foreground">Build and operate services with alerts and monitoring within assigned scope.</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/30 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <RoleBadge role="ADMIN" />
                  <span className="text-sm text-muted-foreground">Administrative access</span>
                </div>
                <p className="text-sm text-foreground">Full control over services, versions, and system configuration. Cannot manage users.</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/30 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <RoleBadge role="SUPER_ADMIN" />
                  <span className="text-sm text-muted-foreground">Full system access</span>
                </div>
                <p className="text-sm text-foreground">Complete control including user management, system settings, and all administrative functions.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  )
}
