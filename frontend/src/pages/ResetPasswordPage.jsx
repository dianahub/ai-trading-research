import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const email = params.get('email') || ''
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const r = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, new_password: form.password }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Reset failed')
      navigate('/login?reset=1')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token || !email) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#060a14' }}>
      <div className="text-center">
        <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>Invalid reset link.</p>
        <Link to="/forgot-password" style={{ color: '#06b6d4', textDecoration: 'none', fontSize: '14px' }}>
          Request a new one
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#060a14' }}>
      <div className="w-full max-w-sm">
        <div className="rounded-2xl p-8" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
          <h1 className="text-xl font-bold mb-6 text-center" style={{ color: '#f1f5f9' }}>Set new password</h1>

          {error && (
            <div className="rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ background: '#1e0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748b' }}>New password</label>
              <input type="password" value={form.password} autoFocus
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748b' }}>Confirm password</label>
              <input type="password" value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff',
                opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
