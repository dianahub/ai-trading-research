import { useState } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAdminHeaders() {
  return { 'x-admin-email': 'contact@starsignal.io', 'x-admin-password': 'BISCUITLOVE', 'Content-Type': 'application/json' }
}

const ROLES = [
  { value: 'user',        label: 'Users (role: user)' },
  { value: 'astrologer',  label: 'Astrologers (role: astrologer)' },
  { value: 'influencer',  label: 'Influencers (role: influencer)' },
  { value: 'admin',       label: 'Admins (role: admin)' },
  { value: 'all',         label: 'Everyone (all roles)' },
]

export default function AdminBroadcast() {
  const [role, setRole]         = useState('user')
  const [subject, setSubject]   = useState('')
  const [body, setBody]         = useState('')
  const [preview, setPreview]   = useState(null)   // { count, emails }
  const [confirm, setConfirm]   = useState(false)
  const [result, setResult]     = useState(null)   // { sent, total, errors }
  const [testResult, setTestResult] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [error, setError]       = useState('')

  async function handlePreview() {
    setError('')
    setPreview(null)
    setLoading(true)
    try {
      const r = await fetch(`${API}/admin/broadcast-email/preview?role=${role}`, { headers: getAdminHeaders() })
      if (!r.ok) throw new Error(await r.text())
      setPreview(await r.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) { setError('Subject and body are required.'); return }
    setConfirm(false)
    setResult(null)
    setError('')
    setLoading(true)
    try {
      const r = await fetch(`${API}/admin/broadcast-email`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ role, subject, body }),
      })
      if (!r.ok) throw new Error(await r.text())
      setResult(await r.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleTest() {
    if (!subject.trim() || !body.trim()) { setError('Subject and body are required.'); return }
    setTestResult(null)
    setError('')
    setTestLoading(true)
    try {
      const r = await fetch(`${API}/admin/broadcast-email/test`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ subject, body }),
      })
      if (!r.ok) throw new Error(await r.text())
      setTestResult(await r.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setTestLoading(false)
    }
  }

  const canSend = subject.trim() && body.trim()

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link to="/admin" className="text-xs mb-8 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>
          ← Admin
        </Link>
        <h1 className="text-3xl font-black mb-1" style={{ color: '#f1f5f9' }}>Broadcast Email</h1>
        <p className="text-sm mb-8" style={{ color: '#94a3b8' }}>Send an email to all users in a given role, one by one.</p>

        <div className="rounded-xl p-6 mb-6" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>

          {/* Role */}
          <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>RECIPIENT ROLE</label>
          <select
            value={role}
            onChange={e => { setRole(e.target.value); setPreview(null); setResult(null) }}
            className="w-full rounded-lg px-3 py-2 text-sm mb-4"
            style={{ background: '#0f1a2e', color: '#e2e8f0', border: '1px solid #1e3a5f', outline: 'none' }}
          >
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>

          {/* Subject */}
          <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>SUBJECT</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Email subject line"
            className="w-full rounded-lg px-3 py-2 text-sm mb-4"
            style={{ background: '#0f1a2e', color: '#e2e8f0', border: '1px solid #1e3a5f', outline: 'none' }}
          />

          {/* Body */}
          <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>BODY (HTML or plain text)</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your email here. HTML is supported."
            rows={10}
            className="w-full rounded-lg px-3 py-2 text-sm font-mono mb-5"
            style={{ background: '#0f1a2e', color: '#e2e8f0', border: '1px solid #1e3a5f', outline: 'none', resize: 'vertical' }}
          />

          {/* Error */}
          {error && (
            <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: '#450a0a', color: '#f87171', border: '1px solid #7f1d1d' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
              style={{ background: '#1e3a5f', color: '#93c5fd', border: '1px solid #2563eb' }}
            >
              {loading ? 'Loading…' : 'Preview Recipients'}
            </button>

            <button
              onClick={handleTest}
              disabled={testLoading || !canSend}
              className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
              style={{ background: '#1e1b4b', color: '#a5b4fc', border: '1px solid #4338ca', opacity: (!canSend) ? 0.5 : 1 }}
            >
              {testLoading ? 'Sending…' : 'Send Test Email'}
            </button>

            <button
              onClick={() => { if (!canSend) { setError('Subject and body are required.'); return } setConfirm(true) }}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
              style={{ background: '#052e16', color: '#34d399', border: '1px solid #065f46', opacity: (!canSend) ? 0.5 : 1 }}
            >
              Send to Role
            </button>
          </div>
        </div>

        {/* Preview panel */}
        {preview && (
          <div className="rounded-xl p-5 mb-4" style={{ background: '#0b1120', border: '1px solid #1e3a5f' }}>
            <div className="text-sm font-semibold mb-3" style={{ color: '#93c5fd' }}>
              {preview.count} recipient{preview.count !== 1 ? 's' : ''} for role <span style={{ color: '#f1f5f9' }}>{role}</span>
            </div>
            {preview.count > 0 && (
              <div className="text-xs space-y-1" style={{ color: '#94a3b8', maxHeight: 160, overflowY: 'auto' }}>
                {preview.emails.map(e => <div key={e}>{e}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div className="rounded-xl px-5 py-4 mb-4 text-sm" style={{ background: '#052e16', color: '#34d399', border: '1px solid #065f46' }}>
            Test email sent to <strong>dianahelene@gmail.com</strong>
          </div>
        )}

        {/* Broadcast result */}
        {result && (
          <div className="rounded-xl p-5 mb-4" style={{ background: '#0b1120', border: '1px solid #065f46' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: '#34d399' }}>
              Sent {result.sent} / {result.total} emails
            </div>
            {result.errors.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: '#f87171' }}>Errors ({result.errors.length})</div>
                <div className="text-xs space-y-1" style={{ color: '#94a3b8', maxHeight: 120, overflowY: 'auto' }}>
                  {result.errors.map((e, i) => <div key={i}><span style={{ color: '#f87171' }}>{e.email}</span>: {e.error}</div>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-sm rounded-xl p-6" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
            <h2 className="text-lg font-bold mb-2" style={{ color: '#f1f5f9' }}>Confirm Broadcast</h2>
            <p className="text-sm mb-1" style={{ color: '#94a3b8' }}>
              You are about to send <strong style={{ color: '#f1f5f9' }}>{subject}</strong> to all users with role <strong style={{ color: '#f1f5f9' }}>{role}</strong>.
            </p>
            {preview && (
              <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>
                That's <strong style={{ color: '#f1f5f9' }}>{preview.count}</strong> recipient{preview.count !== 1 ? 's' : ''}.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleSend}
                className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: '#052e16', color: '#34d399', border: '1px solid #065f46' }}
              >
                Yes, Send
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: '#1e2d45', color: '#94a3b8', border: '1px solid #1e3a5f' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
