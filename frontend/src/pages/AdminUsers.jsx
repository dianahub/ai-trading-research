import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TIERS = ['free', 'beta', 'founding', 'pro', 'premium', 'platform', 'partner_preview']
const PRICING_TIERS = ['', 'founding', 'referred', 'pro']

function headers() {
  return { 'x-admin-email': 'contact@starsignal.io', 'x-admin-password': 'BISCUITLOVE', 'Content-Type': 'application/json' }
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function TierBadge({ tier }) {
  const colors = {
    beta: { bg: '#0e3a4a', color: '#06b6d4' },
    founding: { bg: '#2d1f00', color: '#f59e0b' },
    pro: { bg: '#1a1f35', color: '#818cf8' },
    premium: { bg: '#1a1f35', color: '#a78bfa' },
  }
  const c = colors[tier] || { bg: '#1e2d45', color: '#94a3b8' }
  return <span className="px-2 py-0.5 rounded font-semibold" style={{ background: c.bg, color: c.color }}>{tier}</span>
}

// ── Add User Modal ────────────────────────────────────────────────────────────
function AddUserModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', tier: 'free', pricing_tier: '', send_magic_link: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const r = await fetch(`${API}/admin/users`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ...form, pricing_tier: form.pricing_tier || null }),
    })
    if (r.ok) { onSaved(); onClose() }
    else {
      const j = await r.json().catch(() => ({}))
      setError(j.detail || 'Failed to create user')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-md" style={{ background: '#0b1120', border: '1px solid #1e2d45' }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4" style={{ color: '#f1f5f9' }}>Add User</h2>
        <form onSubmit={submit} className="space-y-3">
          {[['Email', 'email', 'email'], ['First name', 'first_name', 'text'], ['Last name', 'last_name', 'text']].map(([label, key, type]) => (
            <div key={key}>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>{label}</label>
              <input type={type} required={key === 'email'} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }} />
            </div>
          ))}
          <div>
            <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Tier</label>
            <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Pricing tier</label>
            <select value={form.pricing_tier} onChange={e => setForm(f => ({ ...f, pricing_tier: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}>
              {PRICING_TIERS.map(t => <option key={t} value={t}>{t || '—'}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.send_magic_link} onChange={e => setForm(f => ({ ...f, send_magic_link: e.target.checked }))} />
            <span className="text-xs" style={{ color: '#94a3b8' }}>Send magic login link via email</span>
          </label>
          {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#06b6d4', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating…' : 'Create user'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit User Modal ───────────────────────────────────────────────────────────
function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    email: user.email || '',
    tier: user.tier || 'free',
    pricing_tier: user.pricing_tier || '',
    email_verified: user.email_verified ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const r = await fetch(`${API}/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ ...form, pricing_tier: form.pricing_tier || null }),
    })
    if (r.ok) { onSaved(); onClose() }
    else {
      const j = await r.json().catch(() => ({}))
      setError(j.detail || 'Failed to save')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-md" style={{ background: '#0b1120', border: '1px solid #1e2d45' }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1" style={{ color: '#f1f5f9' }}>Edit User</h2>
        <p className="text-xs mb-4" style={{ color: '#475569' }}>{user.email}</p>
        <form onSubmit={submit} className="space-y-3">
          {[['First name', 'first_name'], ['Last name', 'last_name'], ['Email', 'email']].map(([label, key]) => (
            <div key={key}>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>{label}</label>
              <input type="text" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }} />
            </div>
          ))}
          <div>
            <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Tier</label>
            <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Pricing tier</label>
            <select value={form.pricing_tier} onChange={e => setForm(f => ({ ...f, pricing_tier: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}>
              {PRICING_TIERS.map(t => <option key={t} value={t}>{t || '—'}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.email_verified} onChange={e => setForm(f => ({ ...f, email_verified: e.target.checked }))} />
            <span className="text-xs" style={{ color: '#94a3b8' }}>Email verified</span>
          </label>
          {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#3b82f6', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Activity Panel ────────────────────────────────────────────────────────────
function ActivityPanel({ user, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/admin/users/${user.id}/activity`, { headers: headers() })
      .then(r => r.ok ? r.json() : null)
      .then(j => { setData(j); setLoading(false) })
  }, [user.id])

  return (
    <tr>
      <td colSpan={6} style={{ background: '#060d1a', borderTop: '1px solid #1e2d45' }}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: '#f1f5f9' }}>Activity — {user.first_name} {user.last_name}</h3>
            <button onClick={onClose} className="text-xs px-3 py-1 rounded" style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#64748b', cursor: 'pointer' }}>Close</button>
          </div>
          {loading && <p className="text-xs" style={{ color: '#475569' }}>Loading…</p>}
          {data && (
            <div className="grid grid-cols-3 gap-6">
              {/* Stats */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#64748b' }}>Overview</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: '#64748b' }}>Last login</span>
                    <span style={{ color: '#e2e8f0' }}>{fmtTime(data.last_login)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: '#64748b' }}>Sessions (recent)</span>
                    <span style={{ color: '#e2e8f0' }}>{data.sessions.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: '#64748b' }}>Total requests (30d)</span>
                    <span style={{ color: '#e2e8f0' }}>{data.daily_usage.reduce((s, d) => s + d.request_count, 0)}</span>
                  </div>
                </div>
              </div>

              {/* Daily usage */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#64748b' }}>Daily requests (last 30d)</p>
                {data.daily_usage.length === 0
                  ? <p className="text-xs" style={{ color: '#475569' }}>No usage recorded</p>
                  : <div className="space-y-1 max-h-40 overflow-y-auto">
                      {data.daily_usage.map(d => (
                        <div key={d.date} className="flex justify-between text-xs">
                          <span style={{ color: '#64748b' }}>{d.date}</span>
                          <span style={{ color: '#06b6d4' }}>{d.request_count} req</span>
                        </div>
                      ))}
                    </div>
                }
              </div>

              {/* Feedback */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#64748b' }}>Feedback submitted</p>
                {data.feedback.length === 0
                  ? <p className="text-xs" style={{ color: '#475569' }}>No feedback yet</p>
                  : <div className="space-y-2 max-h-40 overflow-y-auto">
                      {data.feedback.map(f => (
                        <div key={f.id} className="rounded p-2" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                          <div className="flex justify-between mb-0.5">
                            <span className="text-xs" style={{ color: '#64748b' }}>{fmtTime(f.created_at)}</span>
                            {f.rating && <span className="text-xs" style={{ color: '#f59e0b' }}>{'★'.repeat(f.rating)}</span>}
                          </div>
                          <p className="text-xs" style={{ color: '#94a3b8' }}>{f.message}</p>
                          {f.page && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Page: {f.page}</p>}
                        </div>
                      ))}
                    </div>
                }
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [activityFor, setActivityFor] = useState(null)

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    const r = await fetch(`${API}/admin/users`, { headers: headers() })
    if (r.ok) setUsers(await r.json())
    setLoading(false)
  }

  const filtered = users.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.first_name + ' ' + u.last_name).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link to="/admin" className="text-xs mb-8 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#f1f5f9' }}>Users</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{users.length} total</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-lg text-xs font-semibold"
              style={{ background: '#06b6d4', color: '#fff', cursor: 'pointer' }}>
              + Add user
            </button>
            <button onClick={refresh} className="px-3 py-2 rounded-lg text-xs"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or name…"
          className="w-full px-4 py-2.5 rounded-lg text-sm outline-none mb-6"
          style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }} />

        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d45' }}>
          <table className="w-full text-xs">
            <thead style={{ background: '#0b1120' }}>
              <tr style={{ color: '#64748b' }}>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Last login</th>
                <th className="text-left px-4 py-3">Tier</th>
                <th className="text-left px-4 py-3">Pricing</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => [
                <tr key={u.id} style={{ borderTop: '1px solid #1e2d45' }}>
                  <td className="px-4 py-3">
                    <div style={{ color: '#f1f5f9' }}>{u.first_name} {u.last_name}</div>
                    <div style={{ color: '#64748b' }}>{u.email}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: '#64748b' }}>{fmt(u.created_at)}</td>
                  <td className="px-4 py-3" style={{ color: '#64748b' }}>{fmt(u.last_login)}</td>
                  <td className="px-4 py-3"><TierBadge tier={u.tier} /></td>
                  <td className="px-4 py-3" style={{ color: u.pricing_tier === 'referred' ? '#22c55e' : u.pricing_tier === 'founding' ? '#f59e0b' : '#64748b' }}>
                    {u.pricing_tier || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(u)}
                        className="px-2.5 py-1 rounded text-xs font-medium"
                        style={{ background: '#1e2d45', color: '#94a3b8', cursor: 'pointer', border: 'none' }}>
                        Edit
                      </button>
                      <button onClick={() => setActivityFor(activityFor?.id === u.id ? null : u)}
                        className="px-2.5 py-1 rounded text-xs font-medium"
                        style={{ background: activityFor?.id === u.id ? '#0e3a4a' : '#1e2d45', color: activityFor?.id === u.id ? '#06b6d4' : '#94a3b8', cursor: 'pointer', border: 'none' }}>
                        Activity
                      </button>
                    </div>
                  </td>
                </tr>,
                activityFor?.id === u.id && <ActivityPanel key={`activity-${u.id}`} user={u} onClose={() => setActivityFor(null)} />,
              ])}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSaved={refresh} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  )
}
