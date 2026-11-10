import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setCsrfToken } from '../../services/apiClient'
import type { Profile, SessionInfo } from '../../services/types'

interface AuthValue {
  user: Profile | null
  session: SessionTiming | null
  setUser: (u: Profile | null) => void
  checking: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<Profile>
  logout: () => Promise<void>
  extendSession: () => Promise<void>
  forgetSession: () => void
}

interface SessionData { user: Profile; csrf_token: string; session?: SessionInfo }
interface SessionTiming { startedAt: string; expiresAt: number; deadline: number; atLimit: boolean }

function sessionTiming(session?: SessionInfo): SessionTiming | null {
  if (!session) return null
  const expiresAt = Date.parse(session.expires_at)
  const remaining = expiresAt - Date.parse(session.server_time)
  if (!Number.isFinite(remaining)) return null
  return {
    startedAt: session.created_at,
    expiresAt,
    deadline: Date.now() + remaining,
    atLimit: expiresAt >= Date.parse(session.max_expires_at),
  }
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [session, setSession] = useState<SessionTiming | null>(null)
  const [checking, setChecking] = useState(true)

  // 새로고침해도 DB 세션이 살아 있으면 로그인 상태와 CSRF 토큰을 복원
  useEffect(() => {
    api<SessionData>('/auth/me')
      .then((d) => { setCsrfToken(d.csrf_token); setUser(d.user); setSession(sessionTiming(d.session)) })
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const d = await api<SessionData>('/auth/login', { method: 'POST', body: { email, password } })
    setCsrfToken(d.csrf_token)
    setUser(d.user)
    setSession(sessionTiming(d.session))
    return d.user
  }, [])

  // 서버가 세션을 폐기한 경우(비밀번호 변경·탈퇴) 화면 쪽 상태만 비운다
  const forgetSession = useCallback(() => { setCsrfToken(null); setUser(null); setSession(null) }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const id = window.setTimeout(async () => {
      // 같은 브라우저의 다른 탭에서 연장했을 수 있으므로 서버 시각을 확인한다.
      try {
        const data = await api<SessionData>('/auth/me')
        if (cancelled) return
        const timing = sessionTiming(data.session)
        if (timing && timing.deadline > Date.now()) {
          setSession(timing)
          return
        }
      } catch {
        if (cancelled) return
      }
      forgetSession()
    }, Math.max(0, session.deadline - Date.now()))
    return () => { cancelled = true; window.clearTimeout(id) }
  }, [session, forgetSession])

  const extendSession = useCallback(async () => {
    const data = await api<{ session: SessionInfo }>('/auth/session/extend', { method: 'POST' })
    const timing = sessionTiming(data.session)
    setSession(current => {
      if (current && timing && current.startedAt === timing.startedAt && timing.expiresAt >= current.expiresAt) {
        return timing
      }
      return current
    })
  }, [])

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }) } finally { forgetSession() }
  }, [forgetSession])

  return (
    <AuthContext.Provider
      value={{ user, session, setUser, checking, login, logout, extendSession, forgetSession,
               isAdmin: !!user && user.role !== 'CUSTOMER' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
