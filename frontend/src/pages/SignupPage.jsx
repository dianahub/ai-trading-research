import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signup, API } from '../lib/auth'

function PasswordStrength({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e']
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  if (!password) return null
  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[0,1,2,3].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all"
            style={{ background: i < score ? colors[score - 1] : '#1e2d45' }} />
        ))}
      </div>
      <p className="text-xs" style={{ color: score > 0 ? colors[score - 1] : '#94a3b8' }}>
        {score > 0 ? labels[score - 1] : ''}
      </p>
    </div>
  )
}

export default function SignupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ref = params.get('ref') || ''

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirm: '', agreed: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.firstName || !form.email || !form.password) { setError('Please fill in all required fields'); return }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setError('Invalid email address'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (!form.agreed) { setError('Please agree to the Terms of Service'); return }
    setLoading(true)
    try {
      await signup(form.email, form.password, form.firstName, form.lastName, ref || undefined)
      navigate('/verify-email?email=' + encodeURIComponent(form.email))
    } catch (err) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
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
          <h1 className="text-xl font-bold mb-6 text-center" style={{ color: '#f1f5f9' }}>Create Account</h1>

          <a
            href={`${API}/auth/oauth/google?redirect=/${ref ? `?ref=${ref}` : ''}`}
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
            <span className="text-xs" style={{ color: '#475569' }}>or sign up with email</span>
            <div className="flex-1 h-px" style={{ background: '#1e2d45' }} />
          </div>

          {error && (
            <div className="rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ background: '#1e0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>First name</label>
                <input value={form.firstName} onChange={set('firstName')} autoFocus
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                  placeholder="First" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>Last name</label>
                <input value={form.lastName} onChange={set('lastName')}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                  placeholder="Last" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>Email</label>
              <input type="email" value={form.email} onChange={set('email')}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>Password</label>
              <input type="password" value={form.password} onChange={set('password')}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                placeholder="At least 8 characters" />
              <PasswordStrength password={form.password} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>Confirm password</label>
              <input type="password" value={form.confirm} onChange={set('confirm')}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                placeholder="••••••••" />
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.agreed}
                onChange={e => setForm(f => ({ ...f, agreed: e.target.checked }))}
                className="mt-0.5 rounded flex-shrink-0" />
              <span className="text-sm" style={{ color: '#94a3b8' }}>
                I agree to the{' '}
                <Link to="/terms" style={{ color: '#06b6d4', textDecoration: 'none' }}>Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" style={{ color: '#06b6d4', textDecoration: 'none' }}>Privacy Policy</Link>
              </span>
            </label>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff',
                opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: '#94a3b8' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#06b6d4', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
