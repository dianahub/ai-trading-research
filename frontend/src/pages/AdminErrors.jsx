import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function headers() {
  return { 'x-admin-email': 'dianahelene@gmail.com', 'x-admin-password': 'BISCUITLOVE', 'Content-Type': 'application/json' }
}

const STATUS_COLOR = {
  500: '#ef4444', 502: '#f97316', 503: '#f97316', 422: '#eab308', 404: '#94a3b8',
}

export default function AdminErrors() {
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    const r = await fetch(`${API}/admin/errors`, { headers: headers() })
    if (r.ok) setErrors(await r.json())
    setLoading(false)
  }

  async function clearAll() {
    if (!window.confirm('Clear all error logs?')) return
    setClearing(true)
    await fetch(`${API}/admin/errors`, { method: 'DELETE', headers: headers() })
    setErrors([])
    setClearing(false)
  }

  const filtered = errors.filter(e =>
    !filter ||
    e.path?.toLowerCase().includes(filter.toLowerCase()) ||
    e.message?.toLowerCase().includes(filter.toLowerCase()) ||
    e.error_type?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link to="/admin" className="text-xs mb-8 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#f1f5f9' }}>Error Log</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
              {errors.length} error{errors.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={refresh} disabled={loading}
              className="px-3 py-2 rounded-lg text-xs"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button onClick={clearAll} disabled={clearing || errors.length === 0}
              className="px-3 py-2 rounded-lg text-xs"
              style={{ background: '#1e0a0a', border: '1px solid #7f1d1d', color: '#fca5a5', cursor: 'pointer', opacity: errors.length === 0 ? 0.5 : 1 }}>
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          </div>
        </div>

        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by path, message, or error type…"
          className="w-full px-4 py-2.5 rounded-lg text-sm outline-none mb-6"
          style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
        />

        {filtered.length === 0 && !loading && (
          <div className="rounded-xl px-6 py-12 text-center" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
            <div className="text-3xl mb-3">✅</div>
            <p style={{ color: '#94a3b8' }}>{filter ? 'No errors match that filter.' : 'No errors logged.'}</p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map(err => (
            <div key={err.id}
              className="rounded-xl overflow-hidden"
              style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>

              {/* Summary row */}
              <button
                onClick={() => setExpanded(expanded === err.id ? null : err.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-3"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>

                <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold font-mono mt-0.5"
                  style={{
                    background: '#1e2d45',
                    color: STATUS_COLOR[err.status] || '#94a3b8',
                  }}>
                  {err.status || '?'}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold" style={{ color: '#94a3b8' }}>
                      {err.method} {err.path}
                    </span>
                    {err.error_type && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: '#1e0a0a', color: '#fca5a5' }}>
                        {err.error_type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5 truncate" style={{ color: '#e2e8f0' }}>{err.message}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                    {err.created_at ? new Date(err.created_at).toLocaleString() : ''}
                  </p>
                </div>

                <span className="shrink-0 text-xs" style={{ color: '#475569' }}>
                  {expanded === err.id ? '▲' : '▼'}
                </span>
              </button>

              {/* Expanded traceback */}
              {expanded === err.id && err.tb && (
                <div style={{ borderTop: '1px solid #1e2d45' }}>
                  <pre className="px-4 py-3 text-xs overflow-x-auto"
                    style={{ color: '#94a3b8', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {err.tb}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
