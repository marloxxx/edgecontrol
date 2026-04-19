/** Session keys for JWT tokens (must match AuthContext / tRPC client). */
export const ACCESS_TOKEN_KEY = 'edgecontrol_access_token'
export const REFRESH_TOKEN_KEY = 'edgecontrol_refresh_token'

export const AUTH_TOKENS_UPDATED_EVENT = 'edgecontrol:auth-tokens-updated'

export function notifyAuthTokensUpdated(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_TOKENS_UPDATED_EVENT))
}

function stripAccessOnly(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

/** Returns true when JWT `exp` is in the future (with a short skew). */
export function isJwtStillUsable(token: string, skewSeconds = 10): boolean {
  try {
    const part = token.split('.')[1]
    if (!part) return false
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    if (typeof payload.exp !== 'number') return true
    return payload.exp * 1000 > Date.now() + skewSeconds * 1000
  } catch {
    return false
  }
}

export function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem(ACCESS_TOKEN_KEY)
}

/** Access token suitable for immediate API use; drops expired tokens from storage. */
export function readValidAccessTokenOrNull(): string | null {
  const t = readAccessToken()
  if (!t) return null
  if (!isJwtStillUsable(t)) {
    stripAccessOnly()
    return null
  }
  return t
}

export function readRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(REFRESH_TOKEN_KEY) ?? localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function storageUsesRememberMe(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(localStorage.getItem(REFRESH_TOKEN_KEY))
}

function clearAllTokenSlots(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function persistAuthTokens(access: string, refresh: string, rememberMe: boolean): void {
  if (typeof window === 'undefined') return
  clearAllTokenSlots()
  const s = rememberMe ? localStorage : sessionStorage
  s.setItem(ACCESS_TOKEN_KEY, access)
  s.setItem(REFRESH_TOKEN_KEY, refresh)
  notifyAuthTokensUpdated()
}

export function clearAuthTokens(): void {
  clearAllTokenSlots()
  notifyAuthTokensUpdated()
}

/** True when async bootstrap should run (refresh present but no usable access). */
export function needsAuthBootstrap(): boolean {
  if (typeof window === 'undefined') return false
  return !readValidAccessTokenOrNull() && Boolean(readRefreshToken())
}
