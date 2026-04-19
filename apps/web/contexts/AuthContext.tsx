'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { Permission, Role } from '@/lib/types'
import {
  AUTH_TOKENS_UPDATED_EVENT,
  clearAuthTokens,
  needsAuthBootstrap,
  persistAuthTokens,
  readAccessToken,
  readValidAccessTokenOrNull
} from '@/lib/auth-storage'
import { hasPermission as rbacCheck, mapApiRoleToUi } from '@/lib/rbac'
import type { Permission as TrpcPermission } from '@edgecontrol/trpc'
import { queryClient, refreshSessionTokens, trpc } from '@/src/lib/trpc'

interface AuthUser {
  id: string
  email: string
  role: string
}

interface AuthContextValue {
  token: string | null
  user: AuthUser | null | undefined
  isAuthenticated: boolean
  isLoadingSession: boolean
  isBootstrapping: boolean
  role: Role
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>
  logout: () => void
  hasPermission: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readValidAccessTokenOrNull())
  const [bootstrapDone, setBootstrapDone] = useState(() => !needsAuthBootstrap())

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: Boolean(token),
    retry: false
  })

  const loginMutation = trpc.auth.login.useMutation()

  const logout = useCallback(() => {
    clearAuthTokens()
    setToken(null)
    queryClient.clear()
  }, [])

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      const data = await loginMutation.mutateAsync({ email, password })
      persistAuthTokens(data.token, data.refreshToken, rememberMe)
      setToken(data.token)
      await queryClient.invalidateQueries()
    },
    [loginMutation]
  )

  useEffect(() => {
    const syncFromStorage = () => {
      setToken(readAccessToken())
    }
    window.addEventListener(AUTH_TOKENS_UPDATED_EVENT, syncFromStorage)
    return () => window.removeEventListener(AUTH_TOKENS_UPDATED_EVENT, syncFromStorage)
  }, [])

  useEffect(() => {
    if (bootstrapDone) return
    let cancelled = false
    void (async () => {
      try {
        await refreshSessionTokens()
      } catch {
        if (!cancelled) {
          clearAuthTokens()
          setToken(null)
        }
      } finally {
        if (!cancelled) setBootstrapDone(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bootstrapDone])

  useEffect(() => {
    if (!token) return
    if (meQuery.isLoading || meQuery.isFetching) return
    if (meQuery.isSuccess && meQuery.data === null) {
      queueMicrotask(() => {
        logout()
      })
    }
  }, [token, meQuery.isLoading, meQuery.isFetching, meQuery.isSuccess, meQuery.data, logout])

  const user = token ? meQuery.data : null
  const isLoadingSession = Boolean(token) && meQuery.isLoading

  const role = mapApiRoleToUi(user?.role)

  const hasPermission = useCallback(
    (permission: Permission) => {
      return rbacCheck(user?.role ?? 'VIEWER', permission as TrpcPermission)
    },
    [user?.role]
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user: user ?? undefined,
      isAuthenticated: Boolean(token && user),
      isLoadingSession: isLoadingSession || !bootstrapDone,
      isBootstrapping: !bootstrapDone,
      role,
      login,
      logout,
      hasPermission
    }),
    [token, user, isLoadingSession, bootstrapDone, role, login, logout, hasPermission]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

/** @deprecated Prefer useAuth — kept for existing components */
export function useRole() {
  const auth = useAuth()
  return {
    role: auth.role,
    setRole: () => {},
    hasPermission: auth.hasPermission
  }
}
