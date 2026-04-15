import { useEffect } from 'react'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useNavigate
} from '@tanstack/react-router'

import { ACCESS_TOKEN_KEY } from '@/lib/auth-storage'
import { AlertsPage } from '@/src/features/alerts'
import { LoginPage } from '@/src/features/auth'
import { HistoryPage } from '@/src/features/history'
import { MonitoringPage } from '@/src/features/monitoring'
import { OverviewPage } from '@/src/features/overview'
import { RoutesPage } from '@/src/features/routes'
import { NodesPage } from '@/src/features/nodes'
import { ServiceDetailPage, ServicesPage } from '@/src/features/services'
import { SettingsPage } from '@/src/features/settings'
import { UsersPage } from '@/src/features/users'
import { VersionsPage } from '@/src/features/versions'

function RootComponent() {
  return <Outlet />
}

function RootRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    void navigate({ to: '/overview', replace: true })
  }, [navigate])
  return null
}

const rootRoute = createRootRoute({
  component: RootComponent
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  validateSearch: (raw: Record<string, unknown>) => ({
    redirect:
      typeof raw.redirect === 'string' && raw.redirect.startsWith('/') ? raw.redirect : '/overview'
  }),
  beforeLoad: () => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
      throw redirect({ to: '/overview' })
    }
  },
  component: LoginPage
})

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: ({ location }) => {
    if (typeof window === 'undefined') return
    if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname }
      })
    }
  },
  component: () => <Outlet />
})

const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  component: RootRedirect
})

const overviewRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'overview',
  component: OverviewPage
})

const servicesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'services',
  component: ServicesPage
})

const nodesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'nodes',
  component: NodesPage
})

const serviceDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'services/$id',
  component: ServiceDetailPage
})

const routesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'routes',
  component: RoutesPage
})

const monitoringRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'monitoring',
  component: MonitoringPage
})

const alertsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'alerts',
  component: AlertsPage
})

const versionsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'versions',
  component: VersionsPage
})

const historyRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'history',
  component: HistoryPage
})

const usersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'users',
  component: UsersPage
})

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: 'settings',
  component: SettingsPage
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appLayoutRoute.addChildren([
    indexRoute,
    overviewRoute,
    servicesRoute,
    nodesRoute,
    serviceDetailRoute,
    routesRoute,
    monitoringRoute,
    alertsRoute,
    versionsRoute,
    historyRoute,
    usersRoute,
    settingsRoute
  ])
])

export const router = createRouter({ routeTree })

export function AppRouter() {
  return <RouterProvider router={router} />
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
