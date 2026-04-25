import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function headers() {
  return { 'x-admin-email': 'contact@starsignal.io', 'x-admin-password': 'BISCUITLOVE' }
}

export default function AdminContacts() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    const r = await fetch(`${API}/admin/contact-messages`, { headers: headers() })
    if (r.ok) setItems(await r.json())
    setLoading(false)
  }

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link to="/admin" className="text-xs mb-8 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#f1f5f9' }}>Contact Messages</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
              {items.length} message{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={refresh} disabled={loading}
            className="px-3 py-2 rounded-lg text-xs"
            style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {items.length === 0 && !loading && (
          <div className="rounded-xl px-6 py-12 text-center" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
            <p style={{ color: '#94a3b8' }}>No contact messages yet.</p>
          </div>
        )}

        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="rounded-xl overflow-hidden"
              style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
              <button
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-3"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{item.name || 'Anonymous'}</span>
                    {item.email && (
                      <span className="text-xs font-mono" style={{ color: '#94a3b8' }}>{item.email}</span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5 truncate" style={{ color: '#94a3b8' }}>{item.message}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                    {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs" style={{ color: '#475569' }}>
                  {expanded === item.id ? '▲' : '▼'}
                </span>
              </button>

              {expanded === item.id && (
                <div style={{ borderTop: '1px solid #1e2d45' }}>
                  <p className="px-4 py-3 text-sm leading-relaxed" style={{ color: '#94a3b8', whiteSpace: 'pre-wrap' }}>
                    {item.message}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
