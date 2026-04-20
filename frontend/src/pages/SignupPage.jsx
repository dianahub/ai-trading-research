import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signup } from '../lib/auth'

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
      <p className="text-xs" style={{ color: score > 0 ? colors[score - 1] : '#475569' }}>
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

        <div className="rounded-2xl p-8" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
          <h1 className="text-xl font-bold mb-6 text-center" style={{ color: '#f1f5f9' }}>Create Account</h1>

          {error && (
            <div className="rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ background: '#1e0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748b' }}>First name</label>
                <input value={form.firstName} onChange={set('firstName')} autoFocus
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                  placeholder="First" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748b' }}>Last name</label>
                <input value={form.lastName} onChange={set('lastName')}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                  placeholder="Last" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748b' }}>Email</label>
              <input type="email" value={form.email} onChange={set('email')}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748b' }}>Password</label>
              <input type="password" value={form.password} onChange={set('password')}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                placeholder="At least 8 characters" />
              <PasswordStrength password={form.password} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748b' }}>Confirm password</label>
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

        <p className="text-center text-sm mt-6" style={{ color: '#475569' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#06b6d4', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
