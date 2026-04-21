import { useState } from 'react'
import { Link } from 'react-router-dom'

const ASTRO_URL = import.meta.env.VITE_ASTRO_URL ?? 'https://astro-api-production.up.railway.app'

export default function PartnersApply() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', website: '', bio: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function handle(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!form.email.trim() || !form.email.includes('@')) { setError('Valid email is required.'); return }
    if (!form.website.trim()) { setError('Website is required.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${ASTRO_URL}/api/v1/partners/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    form.name,
          email:   form.email,
          phone:   form.phone,
          website: form.website,
          bio:     form.bio,
          tier:    'free',
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Submission failed. Please try again.'); return }
      setDone(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    background: '#070b16', border: '1px solid #1e2d45',
    color: '#e2e8f0', caretColor: '#06b6d4',
  }
  const focus = e => (e.target.style.borderColor = '#06b6d4')
  const blur  = e => (e.target.style.borderColor = '#1e2d45')

  return (
    <div className="min-h-screen" style={{ background: '#070b16', color: '#e2e8f0' }}>
      <header className="sticky top-0 z-50 px-6 py-4"
        style={{ background: 'rgba(7,11,22,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d45' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div>
              <div className="text-sm font-bold tracking-widest text-white">Starsignal.io</div>
              <div className="text-xs" style={{ color: '#94a3b8' }}>AI Astro Trading</div>
            </div>
          </Link>
          <Link to="/partners" className="text-sm" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            ← Back to Partners
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 py-14">
        {done ? (
          <div className="rounded-xl p-10 text-center" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <span className="text-white text-xl">✓</span>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Application Received</h2>
            <p className="text-sm" style={{ color: '#94a3b8', lineHeight: 1.7 }}>
              Thanks for applying! We'll review your application and email you at{' '}
              <strong style={{ color: '#e2e8f0' }}>{form.email}</strong> within 48 hours.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Partner Application</h1>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Join our network of financial astrologers</p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg text-sm"
                style={{ background: '#2d1515', border: '1px solid #f87171', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94a3b8' }}>
                    Name <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input name="name" value={form.name} onChange={handle} placeholder="Your name"
                    className="px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}
                    onFocus={focus} onBlur={blur} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94a3b8' }}>
                    Email <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input name="email" type="email" value={form.email} onChange={handle} placeholder="you@example.com"
                    className="px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}
                    onFocus={focus} onBlur={blur} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94a3b8' }}>
                    Phone
                  </label>
                  <input name="phone" type="tel" value={form.phone} onChange={handle} placeholder="+1 (555) 000-0000"
                    className="px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}
                    onFocus={focus} onBlur={blur} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94a3b8' }}>
                    Website <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input name="website" value={form.website} onChange={handle} placeholder="https://yoursite.com"
                    className="px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}
                    onFocus={focus} onBlur={blur} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94a3b8' }}>
                  Short Bio
                </label>
                <textarea name="bio" value={form.bio} onChange={handle} rows={3}
                  placeholder="Tell us about your background in financial astrology..."
                  className="px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={inputStyle}
                  onFocus={focus} onBlur={blur} />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-3 rounded-lg text-sm font-semibold mt-2"
                style={{
                  background: submitting ? '#1e2d45' : 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                  color: submitting ? '#94a3b8' : '#fff',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}>
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            </form>
          </>
        )}
      </div>

      <footer className="px-6 py-8" style={{ borderTop: '1px solid #1e2d45', background: '#0a0e1a' }}>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs" style={{ color: '#94a3b8' }}>© 2026 Futurotek LLC. All rights reserved.</span>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/terms"   style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms</Link>
            <Link to="/privacy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy</Link>
            <a href="https://www.linkedin.com/company/113175994/" target="_blank" rel="noopener noreferrer"
              style={{ color: '#94a3b8', textDecoration: 'none' }}>LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
