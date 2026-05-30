import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { login, API } from '../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/'

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

        <div className="rounded-xl px-4 py-3 mb-5 text-sm text-center"
          style={{ background: '#0a1628', border: '1px solid #1e3a5f', color: '#94a3b8', lineHeight: '1.6' }}>
          Star Signal uses AI to generate real-time market analysis. We ask you to sign in to keep bots from burning through AI tokens —{' '}
          <span style={{ color: '#e2e8f0' }}>your account is free for 30 days, no credit card required.</span>
        </div>

        <div className="rounded-2xl p-8" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
          <h1 className="text-xl font-bold mb-6 text-center" style={{ color: '#f1f5f9' }}>Sign In</h1>

          {error && (
            <div className="rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ background: '#1e0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <a
            href={`${API}/auth/oauth/google?redirect=${encodeURIComponent(redirect)}`}
            className="flex items-center justify-center gap-3 w-full py-2.5 rounded-xl text-sm font-medium mb-5 transition-all"
            style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0', textDecoration: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: '#1e2d45' }} />
            <span className="text-xs" style={{ color: '#475569' }}>or sign in with email</span>
            <div className="flex-1 h-px" style={{ background: '#1e2d45' }} />
          </div>

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
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                  {showPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
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
          <Link to="/signup" style={{ color: '#06b6d4', textDecoration: 'none' }}>Sign up free</Link>
        </p>
      </div>
    </div>
  )
}
