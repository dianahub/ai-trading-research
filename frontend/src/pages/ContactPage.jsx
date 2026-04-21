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
        <h1 className="text-2xl font-bold mb-8" style={{ color: '#f1f5f9' }}>{title}</h1>
        <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
          {children}
        </div>
      </main>

      <footer className="mt-16 px-6 py-8" style={{ borderTop: '1px solid #1e2d45', background: '#0a0e1a' }}>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <span className="text-xs" style={{ color: '#475569' }}>© 2026 <a href="https://dianacastillo.zo.space/futurotek/" target="_blank" rel="noopener noreferrer" style={{ color: '#475569', textDecoration: 'underline' }}>Futurotek LLC</a>. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Terms of Service</Link>
            <Link to="/privacy" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Privacy Policy</Link>
            <Link to="/contact" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Contact</Link>
            <a href="https://www.linkedin.com/company/113175994/" target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
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
      const res = await fetch(`${API}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to send message')
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
    <PageLayout title="Contact">
      <p>Have a question, feedback, or issue? We'd love to hear from you.</p>

      {submitted ? (
        <div className="rounded-lg px-5 py-4" style={{ background: '#052e16', border: '1px solid #065f46' }}>
          <p style={{ color: '#10b981' }}>Message sent! We'll get back to you soon.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>Name</label>
            <input
              name="name"
              type="text"
              required
              placeholder="Your name"
              value={form.name}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>Message</label>
            <textarea
              name="message"
              required
              rows={5}
              placeholder="How can we help?"
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
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:brightness-110 cursor-pointer disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
              color: '#a5b4fc',
              border: '1px solid #3730a3',
            }}
          >
            {loading ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      )}

      <div className="pt-4" style={{ borderTop: '1px solid #1e2d45' }}>
        <p>You can also reach us directly at <strong style={{ color: '#cbd5e1' }}>202-640-0054</strong>.</p>
      </div>
    </PageLayout>
  )
}
