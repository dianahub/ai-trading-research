import { useState } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    await fetch(`${API}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#060a14' }}>
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-3 justify-center mb-8" style={{ textDecoration: 'none' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>✦</div>
          <span className="text-white font-bold tracking-widest text-sm">Star Signal</span>
        </Link>

        <div className="rounded-2xl p-8" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-4">📬</div>
              <h2 className="text-lg font-bold mb-2" style={{ color: '#f1f5f9' }}>Check your inbox</h2>
              <p className="text-sm" style={{ color: '#94a3b8' }}>
                If an account exists for <strong style={{ color: '#e2e8f0' }}>{email}</strong>,
                we've sent a password reset link valid for 1 hour.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-2 text-center" style={{ color: '#f1f5f9' }}>Reset password</h1>
              <p className="text-sm text-center mb-6" style={{ color: '#94a3b8' }}>
                Enter your email and we'll send a reset link
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                    placeholder="you@example.com" />
                </div>
                <button type="submit" disabled={loading || !email}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff',
                    opacity: loading || !email ? 0.6 : 1 }}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm mt-6">
          <Link to="/login" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Back to login</Link>
        </p>
      </div>
    </div>
  )
}
