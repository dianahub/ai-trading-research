import { useState } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TIERS = ['free', 'beta', 'founding', 'pro', 'premium', 'platform', 'partner_preview']

function headers(email, pass) {
  return { 'x-admin-email': email, 'x-admin-password': pass, 'Content-Type': 'application/json' }
}

export default function AdminUsers() {
  const [email, setEmail] = useState(localStorage.getItem('admin_email') || '')
  const [pass, setPass]   = useState(localStorage.getItem('admin_pass')  || '')
  const [authed, setAuthed] = useState(false)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState({})

  async function login(e) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      const r = await fetch(`${API}/admin/users`, { headers: headers(email, pass) })
      if (!r.ok) { setErr('Invalid credentials'); setLoading(false); return }
      localStorage.setItem('admin_email', email)
      localStorage.setItem('admin_pass', pass)
      setUsers(await r.json())
      setAuthed(true)
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }

  async function refresh() {
    const r = await fetch(`${API}/admin/users`, { headers: headers(email, pass) })
    if (r.ok) setUsers(await r.json())
  }

  async function setTier(userId, tier) {
    setSaving(s => ({ ...s, [userId]: true }))
    await fetch(`${API}/admin/users/${userId}/tier`, {
      method: 'PATCH',
      headers: headers(email, pass),
      body: JSON.stringify({ tier }),
    })
    await refresh()
    setSaving(s => ({ ...s, [userId]: false }))
  }

  const filtered = users.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.first_name + ' ' + u.last_name).toLowerCase().includes(search.toLowerCase())
  )

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}>
        <div className="w-full max-w-sm px-4">
          <Link to="/admin" className="text-xs mb-6 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>
          <div className="rounded-xl p-8" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
            <h1 className="text-xl font-bold mb-6" style={{ color: '#f1f5f9' }}>Users</h1>
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
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link to="/admin" className="text-xs mb-8 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#f1f5f9' }}>Users</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{users.length} total</p>
          </div>
          <button onClick={refresh} className="px-3 py-2 rounded-lg text-xs" style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>

        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or name…"
          className="w-full px-4 py-2.5 rounded-lg text-sm outline-none mb-6"
          style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}
        />

        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d45' }}>
          <table className="w-full text-xs">
            <thead style={{ background: '#0b1120' }}>
              <tr style={{ color: '#64748b' }}>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Tier</th>
                <th className="text-left px-4 py-3">Change tier</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderTop: '1px solid #1e2d45' }}>
                  <td className="px-4 py-3">
                    <div style={{ color: '#f1f5f9' }}>{u.first_name} {u.last_name}</div>
                    <div style={{ color: '#64748b' }}>{u.email}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: '#64748b' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded font-semibold" style={{
                      background: u.tier === 'beta' ? '#0e3a4a' : u.tier === 'founding' ? '#2d1f00' : '#1e2d45',
                      color: u.tier === 'beta' ? '#06b6d4' : u.tier === 'founding' ? '#f59e0b' : '#94a3b8',
                    }}>{u.tier}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.tier}
                      onChange={ev => setTier(u.id, ev.target.value)}
                      disabled={saving[u.id]}
                      className="px-2 py-1 rounded text-xs"
                      style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0', cursor: 'pointer' }}
                    >
                      {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {saving[u.id] && <span className="ml-2" style={{ color: '#64748b' }}>saving…</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
