import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function MagicLoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('logging in')
  const [resendEmail, setResendEmail] = useState(params.get('email') || '')
  const [resendSent, setResendSent] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  useEffect(() => {
    const token = params.get('token')
    const email = params.get('email')
    if (!token || !email) { setStatus('invalid'); return }
    fetch(`${API}/auth/magic-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, email }),
    }).then(r => r.json()).then(d => {
      if (d.user) navigate('/dashboard?welcome=1')
      else setStatus('expired')
    }).catch(() => setStatus('error'))
  }, [])

  async function requestNewLink(e) {
    e.preventDefault()
    if (!resendEmail) return
    setResendLoading(true)
    await fetch(`${API}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resendEmail }),
    })
    setResendLoading(false)
    setResendSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#060a14' }}>
      <div className="w-full max-w-sm text-center">
        {status === 'logging in' && (
          <>
            <div className="text-4xl mb-4">✦</div>
            <p className="text-sm" style={{ color: '#94a3b8' }}>Signing you in…</p>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="text-4xl mb-4">⏰</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Link expired</h2>
            <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
              This magic link has expired. Enter your email below and we'll send a new one.
            </p>
            {!resendSent ? (
              <form onSubmit={requestNewLink} className="space-y-3">
                <input
                  type="email" value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                />
                <button type="submit" disabled={resendLoading}
                  className="w-full py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff',
                    opacity: resendLoading ? 0.7 : 1 }}>
                  {resendLoading ? 'Sending…' : 'Send new access link'}
                </button>
              </form>
            ) : (
              <p className="text-sm" style={{ color: '#4ade80' }}>
                New link sent — check your inbox.
              </p>
            )}
            <Link to="/login" className="block mt-6 text-sm" style={{ color: '#475569', textDecoration: 'none' }}>
              ← Back to login
            </Link>
          </>
        )}

        {(status === 'invalid' || status === 'error') && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Invalid link</h2>
            <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>
              This link is invalid or has already been used.
            </p>
            <Link to="/login" className="text-sm" style={{ color: '#06b6d4', textDecoration: 'none' }}>
              Go to login →
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
