import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function headers(email, pass) {
  return { 'x-admin-email': email, 'x-admin-password': pass, 'Content-Type': 'application/json' }
}

export default function AdminPendingUsers() {
  const [email, setEmail] = useState(localStorage.getItem('admin_email') || '')
  const [pass, setPass]   = useState(localStorage.getItem('admin_pass')  || '')
  const [authed, setAuthed] = useState(false)
  const [list, setList]   = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr]     = useState('')
  const [filter, setFilter] = useState('pending')
  const [actioning, setActioning] = useState('')
  const [actionErr, setActionErr] = useState('')

  async function login(e) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      const r = await fetch(`${API}/admin/beta-applications`, { headers: headers(email, pass) })
      if (!r.ok) { setErr('Invalid credentials'); setLoading(false); return }
      const d = await r.json()
      localStorage.setItem('admin_email', email)
      localStorage.setItem('admin_pass', pass)
      setList(d)
      setAuthed(true)
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }

  async function refresh() {
    const r = await fetch(`${API}/admin/beta-applications`, { headers: headers(email, pass) })
    if (r.ok) setList(await r.json())
  }

  async function approve(id) {
    setActioning(id)
    setActionErr('')
    try {
      const r = await fetch(`${API}/admin/beta-applications/${id}/approve`, { method: 'PATCH', headers: headers(email, pass) })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setActionErr(`Failed: ${d.detail || r.status}`)
      }
    } catch (e) { setActionErr(`Network error: ${e.message}`) }
    await refresh()
    setActioning('')
  }

  async function reject(id) {
    setActioning(id)
    setActionErr('')
    try {
      const r = await fetch(`${API}/admin/beta-applications/${id}/reject`, { method: 'PATCH', headers: headers(email, pass) })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setActionErr(`Failed: ${d.detail || r.status}`)
      }
    } catch (e) { setActionErr(`Network error: ${e.message}`) }
    await refresh()
    setActioning('')
  }

  const filtered = filter === 'all' ? list : list.filter(a => a.status === filter)
  const counts = { pending: 0, approved: 0, rejected: 0 }
  list.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++ })

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}>
        <div className="w-full max-w-sm px-4">
          <Link to="/admin" className="text-xs mb-6 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>
          <div className="rounded-xl p-8" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
            <h1 className="text-xl font-bold mb-6" style={{ color: '#f1f5f9' }}>Pending Users</h1>
            {err && <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: '#2d1515', border: '1px solid #f87171', color: '#fca5a5' }}>{err}</div>}
            <form onSubmit={login} className="flex flex-col gap-3">
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin email" type="email" required
                className="px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }} />
              <input value={pass} onChange={e => setPass(e.target.value)} placeholder="Admin password" type="password" required
                className="px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }} />
              <button type="submit" disabled={loading}
                className="py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {loading ? 'Loading…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link to="/admin" className="text-xs mb-8 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#f1f5f9' }}>Pending Users</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Beta access applications</p>
          </div>
          <button onClick={refresh} className="px-3 py-2 rounded-lg text-xs" style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>

        {/* Count tabs */}
        <div className="flex gap-2 mb-6">
          {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: filter === k ? '#1e3a5f' : 'transparent',
                color: filter === k ? '#e2e8f0' : '#94a3b8',
                border: `1px solid ${filter === k ? '#06b6d4' : '#1e2d45'}`,
                cursor: 'pointer',
              }}>
              {label} {k !== 'all' && counts[k] !== undefined ? `(${counts[k]})` : ''}
            </button>
          ))}
        </div>

        {actionErr && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: '#2d1515', border: '1px solid #f87171', color: '#fca5a5' }}>{actionErr}</div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm" style={{ color: '#94a3b8' }}>No {filter !== 'all' ? filter : ''} applications.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(a => (
              <div key={a.id} className="rounded-xl p-5" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>{a.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{a.email}</div>
                    {a.trader_type && <div className="text-xs mt-1" style={{ color: '#64748b' }}>Trader type: {a.trader_type}</div>}
                    {a.how_heard   && <div className="text-xs" style={{ color: '#64748b' }}>Found via: {a.how_heard}</div>}
                    {a.why_text    && <div className="text-xs mt-2" style={{ color: '#94a3b8' }}>{a.why_text}</div>}
                    {a.discount_code && <div className="text-xs mt-1 font-mono" style={{ color: '#06b6d4' }}>Code: {a.discount_code}</div>}
                    <div className="text-xs mt-2" style={{ color: '#334155' }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {a.status === 'pending' && (
                      <>
                        <button onClick={() => approve(a.id)} disabled={actioning === a.id}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: '#14532d', color: '#86efac', border: 'none', cursor: 'pointer' }}>
                          {actioning === a.id ? '…' : 'Approve'}
                        </button>
                        <button onClick={() => reject(a.id)} disabled={actioning === a.id}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: '#2d1515', color: '#f87171', border: 'none', cursor: 'pointer' }}>
                          Reject
                        </button>
                      </>
                    )}
                    {a.status !== 'pending' && (
                      <span className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: a.status === 'approved' ? '#14532d' : '#2d1515', color: a.status === 'approved' ? '#86efac' : '#f87171' }}>
                        {a.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
