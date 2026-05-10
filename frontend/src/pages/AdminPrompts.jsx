import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
function headers() {
  return { 'x-admin-email': import.meta.env.VITE_ADMIN_EMAIL || '', 'x-admin-password': import.meta.env.VITE_ADMIN_PASSWORD || '' }
}

const ROLE_COLORS = {
  system:           { bg: '#0e1e3a', border: '#1e3a6e', text: '#60a5fa' },
  'system (template)': { bg: '#1a1a0a', border: '#3a3a00', text: '#facc15' },
  'user (prefix)':  { bg: '#0e2a1a', border: '#1e5a2e', text: '#4ade80' },
  'user (template)':{ bg: '#0e2a1a', border: '#1e5a2e', text: '#4ade80' },
}

export default function AdminPrompts() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState('')
  const [open, setOpen]       = useState({})

  useEffect(() => {
    fetch(`${API}/admin/prompts`, { headers: headers() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setData(d))
      .catch(() => setErr('Failed to load prompts — check admin credentials'))
      .finally(() => setLoading(false))
  }, [])

  function toggle(id) {
    setOpen(o => ({ ...o, [id]: !o[id] }))
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}>
      <p style={{ color: '#64748b' }}>Loading…</p>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link to="/admin" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← Admin</Link>

        <h1 className="text-2xl font-black mt-4 mb-1" style={{ color: '#f1f5f9' }}>Claude Prompts</h1>
        <p className="text-sm mb-2" style={{ color: '#94a3b8' }}>All system and user prompts sent to Claude in the pipeline. Click a prompt to expand it.</p>

        {data && (
          <p className="text-xs mb-8 font-mono" style={{ color: '#475569' }}>
            Model: <span style={{ color: '#d4a847' }}>{data.model}</span>
          </p>
        )}

        {err && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm" style={{ background: '#1a0a0a', border: '1px solid #ef4444', color: '#f87171' }}>{err}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(data?.prompts ?? []).map(p => {
            const colors = ROLE_COLORS[p.role] ?? ROLE_COLORS.system
            const isOpen = open[p.id]
            return (
              <div key={p.id} style={{ background: '#0b1120', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  onClick={() => toggle(p.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '16px 20px',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>{p.label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}>{p.role}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{p.description}</p>
                  </div>
                  <span style={{ color: '#475569', fontSize: 18, flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #1e2d45', padding: '0 20px 20px' }}>
                    {p.used_in?.length > 0 && (
                      <div style={{ marginTop: 12, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Used in</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {p.used_in.map(u => (
                            <span key={u} style={{ fontSize: 12, fontFamily: 'monospace', background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', padding: '2px 8px', borderRadius: 4 }}>{u}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{
                      background: '#060a14', border: '1px solid #1e2d45', borderRadius: 8,
                      padding: 16, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7,
                      color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      maxHeight: 480, overflowY: 'auto',
                    }}>
                      {p.text}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
