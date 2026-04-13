'use client'

import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'

const loginRouteApi = getRouteApi('/login')

export function LoginPage() {
  const navigate = useNavigate()
  const { redirect: redirectPath } = loginRouteApi.useSearch()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectTo =
    typeof redirectPath === 'string' && redirectPath.startsWith('/') ? redirectPath : '/overview'

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
      void navigate({ to: redirectTo })
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Sign-in failed'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-ptsi min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <Card className="overflow-hidden border border-slate-200/90 bg-white text-slate-900 shadow-xl shadow-slate-900/5">
          <div
            className="h-1.5 w-full"
            style={{
              background: 'linear-gradient(90deg, var(--brand-primary) 0%, var(--brand-secondary) 100%)'
            }}
          />
          <CardHeader className="space-y-1 pb-2 pt-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-ptsi-secondary">PTSI</p>
            <CardTitle className="font-sans text-2xl font-semibold tracking-tight text-ptsi-primary">
              Edgecontrol
            </CardTitle>
            <CardDescription className="text-slate-600">
              Sign in to the Traefik control plane (DTI PTSI)
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[var(--brand-primary)] focus-visible:ring-[var(--brand-primary)]/25"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[var(--brand-primary)] focus-visible:ring-[var(--brand-primary)]/25"
                />
              </div>
              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
              ) : null}
              <Button
                type="submit"
                className="w-full bg-ptsi-primary font-medium text-white shadow-sm hover:bg-ptsi-primary-hover"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-slate-500">
          DTI PTSI · Secure access to infrastructure routing
        </p>
      </div>
    </div>
  )
}
