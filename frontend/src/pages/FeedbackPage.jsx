import { useState } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function PageLayout({ title, children }) {
  return (
    <div style={{ background: '#070b16', minHeight: '100vh', color: '#e2e8f0' }}>
      <header style={{ background: '#0a0e1a', borderBottom: '1px solid #1e2d45' }}
        className="sticky top-0 z-50 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <span className="text-sm font-bold tracking-widest text-white">Starsignal.io</span>
          </Link>
          <Link to="/" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>← Back to app</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#f1f5f9' }}>{title}</h1>
        {children}
      </main>

      <footer className="mt-16 px-6 py-8" style={{ borderTop: '1px solid #1e2d45', background: '#0a0e1a' }}>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <span className="text-xs" style={{ color: '#94a3b8' }}>© 2026 <a href="https://dianacastillo.zo.space/futurotek/" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Futurotek LLC</a>. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Terms</Link>
            <Link to="/privacy" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Privacy</Link>
            <Link to="/contact" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

const RATINGS = [1, 2, 3, 4, 5]

export default function FeedbackPage() {
  const [form, setForm] = useState({ name: '', email: '', rating: null, message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, page: 'main' }),
      })
      if (!res.ok) {
        let msg = 'Failed to submit feedback'
        try { const d = await res.json(); msg = d.detail || msg } catch {}
        throw new Error(msg)
      }
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: '#0f1a2e',
    border: '1px solid #1e3a5f',
    borderRadius: 8,
    color: '#e2e8f0',
    padding: '10px 14px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
  }

  return (
    <PageLayout title="Beta Feedback">
      <p className="text-sm mb-8" style={{ color: '#94a3b8' }}>
        You're one of our early beta testers — your feedback shapes the product. Tell us what's working, what's broken, or what you'd love to see next.
      </p>

      {submitted ? (
        <div className="rounded-xl px-6 py-8 text-center" style={{ background: '#052e16', border: '1px solid #065f46' }}>
          <div className="text-3xl mb-3">🙏</div>
          <p className="font-semibold text-lg mb-1" style={{ color: '#10b981' }}>Thank you for the feedback!</p>
          <p className="text-sm" style={{ color: '#6ee7b7' }}>We read every submission and use it to improve Starsignal.</p>
          <Link to="/" className="inline-block mt-6 text-sm hover:underline" style={{ color: '#06b6d4' }}>← Back to the app</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>Name (optional)</label>
              <input
                name="name"
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>Email (optional)</label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-2" style={{ color: '#94a3b8' }}>Overall rating</label>
            <div className="flex gap-2">
              {RATINGS.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, rating: n }))}
                  className="w-10 h-10 rounded-lg text-lg font-bold transition-all"
                  style={{
                    background: form.rating >= n ? 'linear-gradient(135deg,#06b6d4,#3b82f6)' : '#0f1a2e',
                    border: `1px solid ${form.rating >= n ? '#06b6d4' : '#1e3a5f'}`,
                    color: form.rating >= n ? '#fff' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                  aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
              {form.rating && (
                <span className="self-center text-xs ml-1" style={{ color: '#94a3b8' }}>
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][form.rating]}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>Your feedback <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea
              name="message"
              required
              rows={6}
              placeholder="What's working well? What's confusing? What features would you like to see?"
              value={form.message}
              onChange={handleChange}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 cursor-pointer disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              color: '#fff',
              border: 'none',
            }}
          >
            {loading ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </form>
      )}
    </PageLayout>
  )
}
