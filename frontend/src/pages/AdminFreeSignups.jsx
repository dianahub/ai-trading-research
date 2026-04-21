import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const ASTRO_URL = import.meta.env.VITE_ASTRO_URL ?? 'https://astro-api-production.up.railway.app'
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? ''

function authHeader() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_PASSWORD}` }
}

const STATUS_STYLE = {
  pending:  { bg: '#1a1200', color: '#fbbf24', border: '#3d2f00' },
  approved: { bg: '#052e16', color: '#4ade80', border: '#166534' },
  rejected: { bg: '#2d0a0a', color: '#f87171', border: '#7f1d1d' },
}

export default function AdminFreeSignups() {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState('')
  const [filter, setFilter]   = useState('pending')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${ASTRO_URL}/api/v1/admin/free-signups`, { headers: authHeader() })
      const d = await r.json()
      setList(d.signups ?? [])
    } catch { }
    setLoading(false)
  }

  async function setStatus(id, status) {
    setActioning(id)
    await fetch(`${ASTRO_URL}/api/v1/admin/free-signups/${id}`, {
      method: 'PATCH', headers: authHeader(), body: JSON.stringify({ status }),
    })
    setList(l => l.map(s => s.id === id ? { ...s, status } : s))
    setActioning('')
  }

  async function del(id) {
    if (!confirm('Delete this signup request?')) return
    setActioning(id)
    await fetch(`${ASTRO_URL}/api/v1/admin/free-signups/${id}`, { method: 'DELETE', headers: authHeader() })
    setList(l => l.filter(s => s.id !== id))
    setActioning('')
  }

  const filtered = filter === 'all' ? list : list.filter(s => s.status === filter)
  const counts   = { pending: 0, approved: 0, rejected: 0 }
  list.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++ })

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-2">
          <Link to="/" className="text-xs" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Dashboard</Link>
          <span style={{ color: '#1e2d45' }}>·</span>
          <Link to="/admin/partners" className="text-xs" style={{ color: '#94a3b8', textDecoration: 'none' }}>Partners</Link>
          <span style={{ color: '#1e2d45' }}>·</span>
          <Link to="/admin/astrologers" className="text-xs" style={{ color: '#94a3b8', textDecoration: 'none' }}>Astrologers</Link>
        </div>

        <h1 className="text-2xl font-black mb-1" style={{ color: '#f1f5f9' }}>Free API Signups</h1>
        <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>Review and approve free API key requests</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([k, label]) => (
            <div key={k} className="rounded-xl p-4" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
              <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>{label}</div>
              <div className="text-2xl font-black" style={{ color: STATUS_STYLE[k]?.color ?? '#94a3b8' }}>{counts[k]}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: filter === f ? '#1e3a5f' : 'transparent',
                color:      filter === f ? '#e2e8f0' : '#94a3b8',
                border:     `1px solid ${filter === f ? '#06b6d4' : '#1e2d45'}`,
              }}>
              {f} {f !== 'all' && `(${counts[f] ?? list.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
            <p className="text-sm" style={{ color: '#94a3b8' }}>No {filter !== 'all' ? filter : ''} signups.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(s => {
              const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.pending
              return (
                <div key={s.id} className="rounded-xl p-5"
                  style={{ background: '#0b1120', border: '1px solid #1e3a5f' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>{s.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold capitalize"
                          style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs mb-1" style={{ color: '#94a3b8' }}>{s.email}</p>
                      <div className="flex flex-wrap gap-3 text-xs" style={{ color: '#94a3b8' }}>
                        {s.company  && <span>🏢 {s.company}</span>}
                        {s.website  && <a href={s.website} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>{s.website}</a>}
                      </div>
                      {s.useCase && (
                        <button onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                          className="text-xs mt-2" style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          {expanded === s.id ? '▲ Hide' : '▼ Use case'}
                        </button>
                      )}
                      {expanded === s.id && s.useCase && (
                        <p className="text-xs mt-2 rounded p-2 leading-relaxed"
                          style={{ color: '#94a3b8', background: '#0f1a2e' }}>{s.useCase}</p>
                      )}
                      <p className="text-xs mt-2" style={{ color: '#334155' }}>
                        {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {s.status !== 'approved' && (
                        <button onClick={() => setStatus(s.id, 'approved')} disabled={actioning === s.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: '#052e16', color: '#4ade80', border: '1px solid #166534' }}>
                          {actioning === s.id ? '…' : 'Approve'}
                        </button>
                      )}
                      {s.status !== 'rejected' && (
                        <button onClick={() => setStatus(s.id, 'rejected')} disabled={actioning === s.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: '#2d0a0a', color: '#f87171', border: '1px solid #7f1d1d' }}>
                          {actioning === s.id ? '…' : 'Reject'}
                        </button>
                      )}
                      <button onClick={() => del(s.id)} disabled={actioning === s.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: '#1e2d45', color: '#94a3b8' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
