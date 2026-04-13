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
import { ACCESS_TOKEN_KEY } from '@/lib/auth-storage'
import { hasPermission as rbacCheck, mapApiRoleToUi } from '@/lib/rbac'
import type { Permission as TrpcPermission } from '@edgecontrol/trpc'
import { queryClient, trpc } from '@/src/lib/trpc'

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
  role: Role
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken())

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: Boolean(token),
    retry: false
  })

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, data.token)
      setToken(data.token)
      await queryClient.invalidateQueries()
    }
  })

  const logout = useCallback(() => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    setToken(null)
    queryClient.clear()
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password })
    },
    [loginMutation]
  )

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
      isLoadingSession,
      role,
      login,
      logout,
      hasPermission
    }),
    [token, user, isLoadingSession, role, login, logout, hasPermission]
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
