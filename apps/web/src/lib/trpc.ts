import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink, type TRPCLink } from '@trpc/client'
import type { TRPCClientError } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { observable } from '@trpc/server/observable'
import type { AppRouter } from '@edgecontrol/trpc'

import { persistAuthTokens, readAccessToken, readRefreshToken, storageUsesRememberMe } from '@/lib/auth-storage'

/**
 * API base for tRPC `httpBatchLink`.
 * Production builds always use same-origin `/trpc` (and `/api` elsewhere) so TLS matches the
 * panel hostname (Traefik → nginx → `api:3000`). `VITE_API_URL` is dev-only; baking an external
 * HTTPS origin here triggers Chrome “broken HTTPS” when that origin’s certificate is invalid.
 */
function defaultApiBase(): string {
  if (import.meta.env.PROD) return ''
  if (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim() !== '') {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
  }
  return 'http://localhost:3001'
}

const apiUrl = defaultApiBase()

export const trpc = createTRPCReact<AppRouter>()

const publicAuthPaths = new Set(['auth.login', 'auth.refresh'])

/** Client without the refresh-retry link — avoids recursion when calling `auth.refresh`. */
const bareAuthClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${apiUrl}/trpc`
    })
  ]
})

let refreshInFlight: Promise<void> | null = null

export async function refreshSessionTokens(): Promise<void> {
  if (refreshInFlight) {
    await refreshInFlight
    return
  }
  const rt = readRefreshToken()
  if (!rt) {
    throw new Error('No refresh token')
  }

  refreshInFlight = (async () => {
    const data = await bareAuthClient.auth.refresh.mutate({ refreshToken: rt })
    persistAuthTokens(data.token, data.refreshToken, storageUsesRememberMe())
  })().finally(() => {
    refreshInFlight = null
  })

  await refreshInFlight
}

const unauthorizedRefreshLink: TRPCLink<AppRouter> = () => {
  return ({ next, op }) => {
    return observable<unknown, TRPCClientError<AppRouter>>((observer) => {
      let sub: { unsubscribe: () => void } | undefined

      const attempt = (afterRefresh: boolean) => {
        sub = next(op).subscribe({
          next: (value) => observer.next(value),
          error: (err: TRPCClientError<AppRouter>) => {
            const code = err.data?.code
            if (
              code === 'UNAUTHORIZED' &&
              !afterRefresh &&
              !publicAuthPaths.has(op.path) &&
              readRefreshToken()
            ) {
              void refreshSessionTokens()
                .then(() => {
                  sub?.unsubscribe()
                  attempt(true)
                })
                .catch(() => observer.error(err))
              return
            }
            observer.error(err)
          },
          complete: () => observer.complete()
        })
      }

      attempt(false)

      return () => {
        sub?.unsubscribe()
      }
    })
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const code = (error as { data?: { code?: string } })?.data?.code
        if (code === 'UNAUTHORIZED') return false
        return failureCount < 2
      }
    }
  }
})

export const trpcClient = trpc.createClient({
  links: [unauthorizedRefreshLink, httpBatchLink({
      url: `${apiUrl}/trpc`,
      headers() {
        const token = typeof window !== 'undefined' ? readAccessToken() : null
        const headers: Record<string, string> = {}
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }
        return headers
      }
    })]
})
