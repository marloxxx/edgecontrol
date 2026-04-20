'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Permission } from '@edgecontrol/trpc'
import {
  LayoutDashboard,
  Server,
  GitFork,
  Activity,
  Bell,
  History,
  Users,
  Settings,
  LogOut,
  Menu,
  HardDrive
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebarLayout } from '@/contexts/sidebar-layout-context'
import { cn } from '@/lib/utils'
import { PermissionGate } from './PermissionGate'
import { Button } from '@/components/ui/button'
import { RoleBadge } from './RoleBadge'
import { trpc } from '@/src/lib/trpc'

const LG = '(min-width: 1024px)'

function useMediaLg() {
  const [lg, setLg] = useState(() =>
    typeof globalThis !== 'undefined' && 'matchMedia' in globalThis ? globalThis.matchMedia(LG).matches : false
  )
  useEffect(() => {
    const mq = globalThis.matchMedia(LG)
    const onChange = () => setLg(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return lg
}

export function Sidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const { role, user, logout } = useAuth()
  const { lgExpanded, toggleLgExpanded, mobileDrawerOpen, setMobileDrawerOpen, toggleMobileDrawer } = useSidebarLayout()
  const isLg = useMediaLg()

  const openAlertsQuery = trpc.alert.list.useQuery({ status: 'OPEN' }, { refetchInterval: 30_000 })
  const openAlerts = openAlertsQuery.data?.length ?? 0

  const showWideChrome = isLg ? lgExpanded : mobileDrawerOpen

  const handleMenuButtonClick = useCallback(() => {
    if (globalThis.matchMedia(LG).matches) {
      toggleLgExpanded()
    } else {
      toggleMobileDrawer()
    }
  }, [toggleLgExpanded, toggleMobileDrawer])

  const closeMobileDrawer = useCallback(() => {
    if (!globalThis.matchMedia(LG).matches) {
      setMobileDrawerOpen(false)
    }
  }, [setMobileDrawerOpen])

  const navItems = [
    { href: '/overview', label: 'Overview', icon: LayoutDashboard, permission: Permission.VIEW_DASHBOARD },
    { href: '/services', label: 'Services', icon: Server, permission: Permission.VIEW_SERVICES },
    { href: '/nodes', label: 'Nodes', icon: HardDrive, permission: Permission.VIEW_SERVICES },
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
      {mobileDrawerOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out',
          mobileDrawerOpen ? 'w-60' : 'w-12',
          lgExpanded ? 'lg:w-60' : 'lg:w-14'
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              'flex-shrink-0 border-b border-border',
              showWideChrome ? 'px-3 py-3 sm:px-4' : 'flex flex-col items-center gap-2 px-2 py-3'
            )}
          >
            <button
              type="button"
              onClick={handleMenuButtonClick}
              title={
                isLg
                  ? lgExpanded
                    ? 'Collapse sidebar'
                    : 'Expand sidebar'
                  : mobileDrawerOpen
                    ? 'Close menu'
                    : 'Open menu'
              }
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-surface-raised text-foreground shadow-sm transition-colors hover:bg-overlay-5',
                !showWideChrome && 'lg:w-9'
              )}
            >
              <Menu className="h-4 w-4" strokeWidth={2} />
            </button>

            {showWideChrome ? (
              <div className="mt-2">
                <h1 className="font-mono text-lg font-bold text-cyan-accent">TCP</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">Control Plane</p>
              </div>
            ) : null}
          </div>

          <nav className={cn('min-h-0 flex-1 overflow-y-auto', showWideChrome ? 'space-y-1 p-2 lg:p-3' : 'space-y-1 px-1.5 py-2 lg:px-2')}>
            {navItems.map((item) => (
              <PermissionGate key={item.href} permission={item.permission}>
                <Link to={item.href} onClick={closeMobileDrawer}>
                  <Button
                    variant="ghost"
                    title={item.label}
                    className={cn(
                      'relative h-10 w-full gap-3 rounded-lg border-l-[3px] text-sm transition-colors',
                      showWideChrome ? 'justify-start px-3' : 'justify-center px-0',
                      isActive(item.href)
                        ? 'border-cyan-accent bg-cyan-muted text-foreground hover:bg-cyan-muted'
                        : 'border-transparent text-muted-foreground hover:bg-overlay-3 hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                    {showWideChrome ? <span className="truncate">{item.label}</span> : null}
                    {item.badge && showWideChrome ? (
                      <span className="ml-auto rounded border border-red-500/25 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                        {item.badge}
                      </span>
                    ) : null}
                    {item.badge && !showWideChrome && item.badge > 0 ? (
                      <span className="absolute right-1 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-surface" aria-hidden />
                    ) : null}
                  </Button>
                </Link>
              </PermissionGate>
            ))}
          </nav>

          <div
            className={cn(
              'flex-shrink-0 border-t border-border',
              showWideChrome ? 'space-y-3 p-3' : 'flex flex-col items-center gap-2 px-1 py-3'
            )}
          >
            {showWideChrome ? (
              <>
                <div className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-xs text-foreground">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Synced 3s ago</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">dynamic.d/01-managed.yml → edge</p>
                </div>

                <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-muted font-mono text-xs text-cyan-accent">
                      {user?.email?.slice(0, 2).toUpperCase() ?? '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-foreground">{user?.email ?? '—'}</p>
                      <div className="mt-1">
                        <RoleBadge role={role} />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        logout()
                        void navigate({ to: '/login', search: { redirect: pathname || '/overview' } })
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-muted font-mono text-[10px] text-cyan-accent"
                  title={user?.email ?? undefined}
                >
                  {user?.email?.slice(0, 2).toUpperCase() ?? '—'}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-overlay-3 hover:text-foreground"
                  title="Sign out"
                  onClick={() => {
                    logout()
                    void navigate({ to: '/login', search: { redirect: pathname || '/overview' } })
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
