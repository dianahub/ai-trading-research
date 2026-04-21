import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TRADER_TYPES = ['Crypto', 'Stocks', 'Both', 'Just getting started']
const HOW_HEARD = ['TikTok', 'Friend', 'Astrologer referral', 'Other']

function getRefFromCookie() {
  const match = document.cookie.match(/(?:^|;\s*)ref_partner=([^;]+)/)
  return match ? match[1] : ''
}

export default function BetaPage() {
  const [params] = useSearchParams()
  const refFromUrl = params.get('ref') || ''
  const ref = refFromUrl || getRefFromCookie()

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    trader_type: '', how_heard: '', agreed: false,
    discount_code: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [trialDays, setTrialDays] = useState(30)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Discount code validation state
  const [codeStatus, setCodeStatus] = useState(null) // null | 'valid' | 'invalid' | 'checking'
  const debounceRef = useRef(null)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }))

  function handleCodeChange(e) {
    const val = e.target.value.toUpperCase()
    setForm(f => ({ ...f, discount_code: val }))
    setCodeStatus(null)
    clearTimeout(debounceRef.current)
    if (!val.trim()) return
    setCodeStatus('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/discount-code/validate/${encodeURIComponent(val.trim())}`)
        const d = await r.json()
        setCodeStatus(d.valid ? 'valid' : 'invalid')
      } catch {
        setCodeStatus('invalid')
      }
    }, 500)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.first_name || !form.last_name) { setError('First and last name are required'); return }
    if (!form.email) { setError('Email is required'); return }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setError('Invalid email address'); return }
    if (!form.agreed) { setError('Please agree to the beta terms to continue'); return }
    setLoading(true)
    try {
      const r = await fetch(`${API}/beta/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${form.first_name} ${form.last_name}`.trim(),
          email: form.email,
          trader_type: form.trader_type,
          how_heard: form.how_heard,
          ref: ref || undefined,
          discount_code: form.discount_code.trim() || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Failed to submit')
      setTrialDays(d.trial_days || 30)
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const trialLabel = trialDays === 45 ? '45 days free' : '30 days free'

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <header className="sticky top-0 z-50 px-6 py-4"
        style={{ background: 'rgba(6,10,20,.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d45' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>✦</div>
            <span className="text-white font-bold tracking-widest text-sm">Star Signal</span>
          </Link>
          <Link to="/login" className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'transparent', border: '1px solid #1e2d45', color: '#94a3b8', textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 pt-20 pb-24">
        {submitted ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🌟</div>
            <h1 className="text-2xl font-bold mb-4" style={{ color: '#f1f5f9' }}>Application received!</h1>
            <p className="text-base mb-2" style={{ color: '#94a3b8', lineHeight: 1.7 }}>
              We'll review your application and be in touch within 24 hours.
            </p>
            {trialDays === 45 && (
              <p className="text-sm font-semibold mb-8" style={{ color: '#06b6d4' }}>
                Discount code applied — you get 45 days free!
              </p>
            )}
            <Link to="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', textDecoration: 'none' }}>
              Back to Star Signal
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
                style={{ background: '#0f1a2e', border: '1px solid #1e3a5f', color: '#06b6d4' }}>
                ✦ Limited beta — {trialLabel}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#f1f5f9', lineHeight: 1.2 }}>
                Apply for Beta Access
              </h1>
              <p className="text-base" style={{ color: '#94a3b8', lineHeight: 1.7 }}>
                Full access free for 30 days. No credit card required.
                After 30 days, lock in founding member pricing at{' '}
                <strong style={{ color: '#e2e8f0' }}>$19/month forever</strong>.
              </p>
            </div>

            <div className="rounded-2xl p-8" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
              {error && (
                <div className="rounded-lg px-4 py-3 mb-4 text-sm"
                  style={{ background: '#1e0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>First name *</label>
                    <input value={form.first_name} onChange={set('first_name')} autoFocus
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                      placeholder="Jane" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>Last name *</label>
                    <input value={form.last_name} onChange={set('last_name')}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                      placeholder="Doe" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>Email *</label>
                  <input type="email" value={form.email} onChange={set('email')}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                    placeholder="you@example.com" />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>What kind of trader are you?</label>
                  <select value={form.trader_type} onChange={set('trader_type')}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: '#0f1a2e', border: '1px solid #1e2d45',
                      color: form.trader_type ? '#e2e8f0' : '#94a3b8' }}>
                    <option value="">Select one…</option>
                    {TRADER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>How did you hear about us?</label>
                  <select value={form.how_heard} onChange={set('how_heard')}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: '#0f1a2e', border: '1px solid #1e2d45',
                      color: form.how_heard ? '#e2e8f0' : '#94a3b8' }}>
                    <option value="">Select one…</option>
                    {HOW_HEARD.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Discount code field */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94a3b8' }}>
                    Have a discount code? <span style={{ fontWeight: 400 }}>(optional — unlocks 45 days free)</span>
                  </label>
                  <div className="relative">
                    <input
                      value={form.discount_code}
                      onChange={handleCodeChange}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none pr-10"
                      style={{
                        background: '#0f1a2e',
                        border: `1px solid ${codeStatus === 'valid' ? '#22c55e' : codeStatus === 'invalid' ? '#ef4444' : '#1e2d45'}`,
                        color: '#e2e8f0',
                        letterSpacing: '0.05em',
                      }}
                      placeholder="e.g. ROWAN"
                      maxLength={20}
                    />
                    {codeStatus === 'checking' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#64748b' }}>...</span>
                    )}
                    {codeStatus === 'valid' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">✓</span>
                    )}
                    {codeStatus === 'invalid' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">✗</span>
                    )}
                  </div>
                  {codeStatus === 'valid' && (
                    <p className="text-xs mt-1.5 font-semibold" style={{ color: '#22c55e' }}>
                      45 days free unlocked!
                    </p>
                  )}
                  {codeStatus === 'invalid' && (
                    <p className="text-xs mt-1.5" style={{ color: '#94a3b8' }}>
                      Code not recognized — you'll still get 30 days free.
                    </p>
                  )}
                </div>

                <label className="flex items-start gap-3 cursor-pointer rounded-lg p-3"
                  style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                  <input type="checkbox" checked={form.agreed} onChange={setCheck('agreed')}
                    className="mt-0.5 flex-shrink-0" />
                  <span className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                    I understand my free beta access lasts 30 days. In return I agree to share honest
                    feedback at 2 weeks and 30 days. After beta I can continue at the founding member
                    rate of $19/month.
                  </span>
                </label>

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl font-bold text-base transition-all"
                  style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff',
                    opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Submitting…' : 'Apply for Beta Access'}
                </button>

                <p className="text-center text-xs" style={{ color: '#94a3b8' }}>
                  Limited spots · No credit card needed
                </p>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
