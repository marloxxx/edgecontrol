'use client'

import { useEffect, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Permission } from '@edgecontrol/trpc'
import { LayoutDashboard, Server, GitFork, Activity, Bell, History, Users, Settings, LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionGate } from './PermissionGate'
import { Button } from '@/components/ui/button'
import { RoleBadge } from './RoleBadge'
import { trpc } from '@/src/lib/trpc'

export function Sidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const { role, user, logout } = useAuth()
  const openAlertsQuery = trpc.alert.list.useQuery({ status: 'OPEN' }, { refetchInterval: 30_000 })
  const openAlerts = openAlertsQuery.data?.length ?? 0
  const [isExpandedMobile, setIsExpandedMobile] = useState(() => {
    try {
      return globalThis.localStorage?.getItem('edgecontrol.sidebar.expanded') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    globalThis.localStorage?.setItem('edgecontrol.sidebar.expanded', String(isExpandedMobile))
  }, [isExpandedMobile])

  const navItems = [
    { href: '/overview', label: 'Overview', icon: LayoutDashboard, permission: Permission.VIEW_DASHBOARD },
    { href: '/services', label: 'Services', icon: Server, permission: Permission.VIEW_SERVICES },
    { href: '/routes', label: 'Routes', icon: GitFork, permission: Permission.VIEW_SERVICES },
    { href: '/monitoring', label: 'Monitoring', icon: Activity, permission: Permission.VIEW_MONITORING },
    { href: '/alerts', label: 'Alerts', icon: Bell, permission: Permission.VIEW_ALERTS, badge: openAlerts },
    { href: '/versions', label: 'Versions', icon: History, permission: Permission.VIEW_SERVICES },
    { href: '/users', label: 'Users', icon: Users, permission: Permission.VIEW_USERS },
    { href: '/settings', label: 'Settings', icon: Settings, permission: Permission.VIEW_SETTINGS }
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed z-50 left-3 top-3 h-9 w-9 rounded-md border border-border bg-surface-raised text-zinc-300 flex items-center justify-center"
        onClick={() => setIsExpandedMobile((value) => !value)}
      >
        <Menu className="h-4 w-4" />
      </button>
      <div
        className={`fixed left-0 top-0 z-40 bg-surface border-r border-border h-screen shadow-card transition-all duration-200
        ${isExpandedMobile ? 'w-60' : 'w-12 lg:w-60'}
        `}
      >
        <div className="flex h-full flex-col">
          <div className={`border-b border-border flex-shrink-0 ${isExpandedMobile ? 'px-4 py-4' : 'px-2 py-4 lg:px-6'}`}>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-cyan-accent font-mono">TCP</h1>
            </div>
            <p className={`text-xs text-slate-400 ${isExpandedMobile ? 'block' : 'hidden lg:block'}`}>Control Plane</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-1">
            {navItems.map((item) => (
              <PermissionGate key={item.href} permission={item.permission}>
                <Link to={item.href}>
                  <Button
                    variant="ghost"
                    title={item.label}
                    className={`w-full ${isExpandedMobile ? 'justify-start px-3' : 'justify-center px-2 lg:justify-start lg:px-3'} gap-3 text-sm rounded-md ${isActive(item.href)
                        ? 'border-l-2 border-cyan-accent bg-cyan-500/10 text-white'
                        : 'text-zinc-300 hover:bg-overlay-3'
                      }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className={`${isExpandedMobile ? 'inline' : 'hidden lg:inline'}`}>{item.label}</span>
                    {item.badge ? (
                      <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/15 text-red-300 border border-red-500/25 ${isExpandedMobile ? 'inline' : 'hidden lg:inline'}`}>
                        {item.badge}
                      </span>
                    ) : null}
                  </Button>
                </Link>
              </PermissionGate>
            ))}
          </nav>

          {/* Footer */}
          <div className={`border-t border-border space-y-3 flex-shrink-0 ${isExpandedMobile ? 'p-3' : 'p-2 lg:p-3'}`}>
            <div className={`${isExpandedMobile ? 'block' : 'hidden lg:block'}`}>
              <div className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Synced 3s ago</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">dynamic.yml → VPS-1</p>
              </div>
            </div>

            <div className={`bg-surface-raised rounded-lg border border-border-subtle p-3 ${isExpandedMobile ? 'block' : 'hidden lg:block'}`}>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-mono text-xs">
                  {user?.email?.slice(0, 2).toUpperCase() ?? '—'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-zinc-300">{user?.email ?? '—'}</p>
                  <div className="mt-1">
                    <RoleBadge role={role} />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-400 hover:text-white"
                  onClick={() => {
                    logout()
                    void navigate({ to: '/login', search: { redirect: pathname || '/overview' } })
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
