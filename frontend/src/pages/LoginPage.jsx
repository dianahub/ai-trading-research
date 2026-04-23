import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { login } from '../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/dashboard'

  const [form, setForm] = useState({ email: '', password: '', rememberMe: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) { setError('Please fill in all fields'); return }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setError('Invalid email address'); return }
    setLoading(true)
    try {
      const res = await login(form.email, form.password, form.rememberMe)
      if (res.redirect) navigate(res.redirect)
      else navigate(redirect)
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-xl font-bold mb-6 text-center" style={{ color: '#f1f5f9' }}>Sign In</h1>

          {error && (
            <div className="rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ background: '#1e0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>Email</label>
              <input
                type="email" value={form.email} autoFocus
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Password</label>
                <Link to="/forgot-password" className="text-xs" style={{ color: '#06b6d4', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none pr-10"
                  style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.rememberMe}
                onChange={e => setForm(f => ({ ...f, rememberMe: e.target.checked }))}
                className="rounded" />
              <span className="text-sm" style={{ color: '#94a3b8' }}>Remember me for 30 days</span>
            </label>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff',
                opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: '#94a3b8' }}>
          Don't have an account?{' '}
          <Link to="/beta" style={{ color: '#06b6d4', textDecoration: 'none' }}>Apply for beta access</Link>
        </p>
      </div>
    </div>
  )
}
