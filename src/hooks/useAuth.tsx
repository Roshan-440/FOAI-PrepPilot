import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { AuthUser, LoginInput, SignupInput } from '@shared/validation'
import { ApiError, SESSION_EXPIRED_EVENT, api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login(input: LoginInput): Promise<AuthUser>
  signup(input: SignupInput): Promise<AuthUser>
  logout(): Promise<void>
  /** Re-reads the current user (e.g. after onboarding completes). */
  refresh(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const ME_KEY = ['auth', 'me'] as const

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { user } = await api<{ user: AuthUser }>('/auth/me')
    return user
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null // simply not signed in
    throw err
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: user = null, isLoading } = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 5 * 60_000, retry: false })

  /** Drop every cached query so one user's data can never be shown to the next. */
  const clearSession = useCallback(() => {
    qc.clear()
    qc.setQueryData(ME_KEY, null)
  }, [qc])

  useEffect(() => {
    const onExpired = () => {
      clearSession()
      toast.info('Your session has expired. Please sign in again.')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [clearSession, toast])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      async login(input) {
        const res = await api<{ user: AuthUser }>('/auth/login', { method: 'POST', body: input })
        qc.clear()
        qc.setQueryData(ME_KEY, res.user)
        return res.user
      },
      async signup(input) {
        const res = await api<{ user: AuthUser }>('/auth/signup', { method: 'POST', body: input })
        qc.clear()
        qc.setQueryData(ME_KEY, res.user)
        return res.user
      },
      async logout() {
        try {
          await api('/auth/logout', { method: 'POST' })
        } finally {
          clearSession() // even if the network call failed, leave the UI signed out
        }
      },
      async refresh() {
        await qc.invalidateQueries({ queryKey: ME_KEY })
      },
    }),
    [user, isLoading, qc, clearSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
