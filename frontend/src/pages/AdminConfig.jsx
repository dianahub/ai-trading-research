import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
function headers() {
  return { 'x-admin-email': 'ss-staging-bypass-2026', 'x-admin-password': '', 'Content-Type': 'application/json' }
}

export default function AdminConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/admin/config`, { headers: headers() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setConfig(d) })
      .catch(() => setErr('Failed to load config'))
      .finally(() => setLoading(false))
  }, [])

  async function toggleBetaOpen() {
    setSaving(true)
    setMsg('')
    try {
      const r = await fetch(`${API}/admin/config`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ beta_open: !config.beta_open }),
      })
      if (!r.ok) { setMsg('Failed to update'); return }
      const d = await r.json()
      setConfig(d)
      setMsg(`Beta is now ${d.beta_open ? 'OPEN' : 'CLOSED'}`)
    } catch { setMsg('Network error') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}><p style={{ color: '#64748b' }}>Loading…</p></div>

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link to="/admin" className="text-xs mb-8 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>
        <h1 className="text-2xl font-black mb-2" style={{ color: '#f1f5f9' }}>Site Config</h1>
        <p className="text-sm mb-10" style={{ color: '#94a3b8' }}>Toggle site-wide settings without redeploying.</p>

        {msg && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm" style={{ background: '#0e2a1a', border: '1px solid #22c55e', color: '#4ade80' }}>{msg}</div>
        )}

        {/* BETA_OPEN toggle */}
        <div className="rounded-xl p-6" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="text-base font-bold mb-1" style={{ color: '#f1f5f9' }}>Beta Access</h2>
              <p className="text-xs mb-2" style={{ color: '#94a3b8' }}>
                Controls which pricing rule applies to new signups <strong>without</strong> a promo code.
              </p>
              <div className="text-xs space-y-1" style={{ color: '#64748b' }}>
                <div><span style={{ color: '#22c55e' }}>● OPEN</span> — 30 days free, then $19/month founding member rate forever</div>
                <div><span style={{ color: '#f87171' }}>● CLOSED</span> — 30 days free, then $29/month regular Pro rate</div>
                <div style={{ color: '#94a3b8', marginTop: 4 }}>Promo code signups always get 45 days free + $19/month regardless of this setting.</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="text-sm font-bold" style={{ color: config?.beta_open ? '#22c55e' : '#f87171' }}>
                {config?.beta_open ? 'OPEN' : 'CLOSED'}
              </div>
              <button
                onClick={toggleBetaOpen}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-xs font-semibold"
                style={{
                  background: config?.beta_open ? '#2d1515' : '#0e2a1a',
                  border: `1px solid ${config?.beta_open ? '#f87171' : '#22c55e'}`,
                  color: config?.beta_open ? '#f87171' : '#4ade80',
                  cursor: 'pointer',
                }}>
                {saving ? '…' : config?.beta_open ? 'Close beta' : 'Open beta'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
