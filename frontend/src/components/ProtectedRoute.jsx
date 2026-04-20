import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getMe, isPublicDomain } from '../lib/auth'

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true'

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const [status, setStatus] = useState('loading') // loading | authed | unauthed

  useEffect(() => {
    if (!AUTH_ENABLED || isPublicDomain()) { setStatus('authed'); return }
    getMe().then(user => setStatus(user ? 'authed' : 'unauthed'))
  }, [])

  if (!AUTH_ENABLED || isPublicDomain()) return children
  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}>
      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (status === 'unauthed') {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }
  return children
}
