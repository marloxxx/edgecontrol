import { QueryClient } from '@tanstack/react-query'
import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@edgecontrol/trpc'

import { ACCESS_TOKEN_KEY } from '@/lib/auth-storage'

/** In Docker production, leave unset so calls use same-origin `/trpc` (nginx → `http://api:3000`). */
function defaultApiBase(): string {
  if (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim() !== '') {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
  }
  if (import.meta.env.PROD) return ''
  return 'http://localhost:3001'
}

const apiUrl = defaultApiBase()

export const trpc = createTRPCReact<AppRouter>()

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
  links: [
    httpBatchLink({
      url: `${apiUrl}/trpc`,
      headers() {
        const token =
          typeof window !== 'undefined' ? sessionStorage.getItem(ACCESS_TOKEN_KEY) : null
        const headers: Record<string, string> = {}
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }
        return headers
      }
    })
  ]
})
