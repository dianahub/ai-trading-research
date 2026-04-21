import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const email = params.get('email') || ''
  const [status, setStatus] = useState(token ? 'verifying' : 'waiting')
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (!token || !email) return
    fetch(`${API}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email }),
    }).then(r => r.json()).then(d => {
      if (d.ok) { setStatus('verified'); setTimeout(() => navigate('/dashboard?welcome=1'), 2000) }
      else setStatus('error')
    }).catch(() => setStatus('error'))
  }, [token, email])

  async function resendVerification() {
    if (!email) return
    setResent(true)
    await fetch(`${API}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#060a14' }}>
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-6">
          {status === 'verifying' ? '⏳' : status === 'verified' ? '✅' : status === 'error' ? '❌' : '📬'}
        </div>
        {status === 'waiting' && (
          <>
            <h1 className="text-xl font-bold mb-3" style={{ color: '#f1f5f9' }}>Check your inbox</h1>
            <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
              We sent a verification link to <strong style={{ color: '#e2e8f0' }}>{email || 'your email'}</strong>.
              Click the link in the email to activate your account.
            </p>
            {!resent ? (
              <button onClick={resendVerification}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8' }}>
                Resend verification email
              </button>
            ) : (
              <p className="text-sm" style={{ color: '#4ade80' }}>Verification email resent!</p>
            )}
          </>
        )}
        {status === 'verifying' && (
          <p className="text-sm" style={{ color: '#94a3b8' }}>Verifying your email…</p>
        )}
        {status === 'verified' && (
          <>
            <h1 className="text-xl font-bold mb-3" style={{ color: '#f1f5f9' }}>Email verified!</h1>
            <p className="text-sm" style={{ color: '#94a3b8' }}>Redirecting to your dashboard…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold mb-3" style={{ color: '#f1f5f9' }}>Link expired or invalid</h1>
            <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
              This verification link has expired or already been used.
            </p>
            {!resent ? (
              <button onClick={resendVerification}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff' }}>
                Request new verification email
              </button>
            ) : (
              <p className="text-sm" style={{ color: '#4ade80' }}>New verification email sent!</p>
            )}
          </>
        )}
        <Link to="/login" className="block mt-8 text-sm" style={{ color: '#94a3b8', textDecoration: 'none' }}>
          ← Back to login
        </Link>
      </div>
    </div>
  )
}
