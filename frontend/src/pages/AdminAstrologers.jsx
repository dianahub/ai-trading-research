import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const ASTRO_URL = import.meta.env.VITE_ASTRO_URL ?? 'https://astro-api-production.up.railway.app'
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? ''

function authHeader() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_PASSWORD}` }
}

const EMPTY = { name: '', email: '', website: '', twitter: '', feedUrl: '', topics: '', notes: '' }

export default function AdminAstrologers() {
  const [list, setList]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null)   // null | 'new' | { ...record }
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [deleting, setDeleting] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${ASTRO_URL}/api/v1/admin/astrologers`, { headers: authHeader() })
      const d = await r.json()
      setList(d.astrologers ?? [])
    } catch { setError('Failed to load') }
    setLoading(false)
  }

  function openNew() { setEditing('new'); setForm(EMPTY); setError('') }
  function openEdit(a) { setEditing(a); setForm({ ...a }); setError('') }
  function closeEdit() { setEditing(null); setError('') }

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const isNew = editing === 'new'
      const url   = isNew
        ? `${ASTRO_URL}/api/v1/admin/astrologers`
        : `${ASTRO_URL}/api/v1/admin/astrologers/${editing.id}`
      const r = await fetch(url, {
        method:  isNew ? 'POST' : 'PATCH',
        headers: authHeader(),
        body:    JSON.stringify(form),
      })
      if (!r.ok) { const d = await r.json(); setError(d.error ?? 'Save failed'); setSaving(false); return }
      await load()
      closeEdit()
    } catch { setError('Network error') }
    setSaving(false)
  }

  async function del(id) {
    if (!confirm('Delete this astrologer contact?')) return
    setDeleting(id)
    await fetch(`${ASTRO_URL}/api/v1/admin/astrologers/${id}`, { method: 'DELETE', headers: authHeader() })
    setList(l => l.filter(a => a.id !== id))
    setDeleting('')
  }

  const field = (k, label, placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>{label}</label>
      <input
        value={form[k]}
        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: '#060a14', border: '1px solid #1e2d45', color: '#e2e8f0' }}
        onFocus={e => (e.target.style.borderColor = '#06b6d4')}
        onBlur={e  => (e.target.style.borderColor = '#1e2d45')}
      />
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link to="/" className="text-xs" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Dashboard</Link>
          <span style={{ color: '#1e2d45' }}>·</span>
          <Link to="/admin/partners" className="text-xs" style={{ color: '#94a3b8', textDecoration: 'none' }}>Partners</Link>
          <span style={{ color: '#1e2d45' }}>·</span>
          <Link to="/admin/free-signups" className="text-xs" style={{ color: '#94a3b8', textDecoration: 'none' }}>Free Signups</Link>
        </div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#f1f5f9' }}>Astrologer Contacts</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Contact info for astrologers whose feeds are used in the API</p>
          </div>
          <button
            onClick={openNew}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff' }}
          >
            + Add Astrologer
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading…</p>
        ) : list.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
            <p className="text-sm" style={{ color: '#94a3b8' }}>No astrologer contacts yet. Click "Add Astrologer" to get started.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d45' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0b1120', borderBottom: '1px solid #1e2d45' }}>
                  {['Name', 'Email', 'Feed URL', 'Topics', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#94a3b8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((a, i) => (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? '#070c18' : '#0b1120', borderBottom: '1px solid #1e2d45' }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: '#f1f5f9' }}>{a.name}</div>
                      {a.website && <a href={a.website} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: '#06b6d4' }}>{a.website}</a>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>
                      {a.email || <span style={{ color: '#334155' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.feedUrl ? <a href={a.feedUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>{a.feedUrl}</a> : <span style={{ color: '#334155' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{a.topics || <span style={{ color: '#334155' }}>—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(a)} className="px-3 py-1 rounded text-xs font-semibold"
                          style={{ background: '#1e2d45', color: '#e2e8f0' }}>Edit</button>
                        <button onClick={() => del(a.id)} disabled={deleting === a.id} className="px-3 py-1 rounded text-xs font-semibold"
                          style={{ background: '#2d0a0a', color: '#f87171' }}>
                          {deleting === a.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / New modal */}
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && closeEdit()}>
          <div className="w-full max-w-lg rounded-2xl p-8"
            style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
            <h2 className="text-lg font-black mb-6" style={{ color: '#f1f5f9' }}>
              {editing === 'new' ? 'Add Astrologer' : `Edit — ${editing.name}`}
            </h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {field('name',    'Name *', 'Astrologer name')}
                {field('email',   'Email',  'contact@example.com')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field('website', 'Website', 'https://...')}
                {field('twitter', 'Twitter / X', '@handle')}
              </div>
              {field('feedUrl', 'RSS Feed URL', 'https://...')}
              {field('topics',  'Topics', 'crypto, gold, tech stocks')}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
                  style={{ background: '#060a14', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                  onFocus={e => (e.target.style.borderColor = '#06b6d4')}
                  onBlur={e  => (e.target.style.borderColor = '#1e2d45')}
                />
              </div>
              {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={closeEdit} className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#1e2d45', color: '#94a3b8' }}>Cancel</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
