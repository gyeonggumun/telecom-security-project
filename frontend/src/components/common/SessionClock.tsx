import { useEffect, useState } from 'react'
import { useAuth } from '../../app/providers/AuthProvider'

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function SessionClock() {
  const { session, extendSession } = useAuth()
  const [now, setNow] = useState(() => Date.now())
  const [extending, setExtending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!session) return null
  const remaining = session.deadline - now
  async function onExtend() {
    setExtending(true)
    setError('')
    try {
      await extendSession()
      setNow(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : '접속 시간을 연장하지 못했습니다.')
    } finally {
      setExtending(false)
    }
  }
  return (
    <span className="session-clock">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      <span className="session-clock__label">남은 접속 시간</span>
      <span className="session-clock__time" role="timer" aria-label="남은 접속 시간">{fmt(remaining)}</span>
      <button className="session-clock__extend" type="button" onClick={onExtend}
              disabled={extending || remaining <= 0 || session.atLimit}
              title={session.atLimit ? '최초 로그인 후 최대 8시간까지 접속할 수 있습니다.' : undefined}>
        {extending ? '연장 중' : '연장'}
      </button>
      {error && <span className="session-clock__error" role="alert">{error}</span>}
    </span>
  )
}
