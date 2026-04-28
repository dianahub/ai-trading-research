import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-admin-email':    'contact@starsignal.io',
    'x-admin-password': 'BISCUITLOVE',
  }
}

const EMPTY = { name: '', email: '', website: '', twitter: '', feedUrl: '', topics: '', notes: '' }

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button
      onClick={copy}
      className="px-2 py-0.5 rounded text-xs font-semibold ml-2"
      style={{ background: copied ? '#14532d' : '#1e2d45', color: copied ? '#4ade80' : '#94a3b8', transition: 'all .2s' }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function AdminAstrologers() {
  const [list, setList]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [deleting, setDeleting] = useState('')

  // per-row partner creation state
  const [making, setMaking]     = useState({})  // id → true while in flight
  const [madeIds, setMadeIds]   = useState({})  // id → partner record once done
  const [makeErr, setMakeErr]   = useState({})  // id → error string

  // partner accounts table
  const [partners, setPartners]               = useState([])
  const [partnersLoading, setPartnersLoading] = useState(true)
  const [resending, setResending]             = useState('')
  const [deactivating, setDeactivating]       = useState('')
  const [emailingMe, setEmailingMe]           = useState('')

  useEffect(() => { load(); loadPartners() }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/admin/astrologers`, { headers: adminHeaders() })
      const d = await r.json()
      setList(d.astrologers ?? [])
    } catch { setError('Failed to load') }
    setLoading(false)
  }

  async function loadPartners() {
    setPartnersLoading(true)
    try {
      const r = await fetch(`${API}/admin/partner-accounts`, { headers: adminHeaders() })
      if (r.ok) setPartners(await r.json())
    } catch {}
    setPartnersLoading(false)
  }

  // ── Astrologer CRUD ───────────────────────────────────────────────────────────
  function openNew()    { setEditing('new'); setForm(EMPTY); setError('') }
  function openEdit(a)  { setEditing(a); setForm({ ...a }); setError('') }
  function closeEdit()  { setEditing(null); setError('') }

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const isNew = editing === 'new'
      const url   = isNew
        ? `${API}/admin/astrologers`
        : `${API}/admin/astrologers/${editing.id}`
      const r = await fetch(url, {
        method:  isNew ? 'POST' : 'PATCH',
        headers: adminHeaders(),
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
    await fetch(`${API}/admin/astrologers/${id}`, { method: 'DELETE', headers: adminHeaders() })
    setList(l => l.filter(a => a.id !== id))
    setDeleting('')
  }

  // ── Make Partner ──────────────────────────────────────────────────────────────
  async function makePartner(a) {
    if (!a.email) {
      setMakeErr(e => ({ ...e, [a.id]: 'No email on file' }))
      return
    }
    setMaking(m => ({ ...m, [a.id]: true }))
    setMakeErr(e => ({ ...e, [a.id]: '' }))
    try {
      const parts = a.name.trim().split(/\s+/)
      const first = parts[0] ?? ''
      const last  = parts.slice(1).join(' ')
      const r = await fetch(`${API}/admin/partner-accounts`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          first_name:       first,
          last_name:        last,
          email:            a.email,
          publication_name: a.website || '',
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setMakeErr(e => ({ ...e, [a.id]: d.detail ?? 'Failed' }))
      } else {
        setMadeIds(m => ({ ...m, [a.id]: d }))
        setPartners(p => [d, ...p])
      }
    } catch {
      setMakeErr(e => ({ ...e, [a.id]: 'Network error' }))
    }
    setMaking(m => ({ ...m, [a.id]: false }))
  }

  // ── Partner actions ───────────────────────────────────────────────────────────
  async function resendWelcome(id) {
    setResending(id)
    try {
      const r = await fetch(`${API}/admin/partner-accounts/${id}/resend-welcome`, {
        method: 'POST', headers: adminHeaders(),
      })
      if (!r.ok) alert('Failed to resend email')
    } catch { alert('Network error') }
    setResending('')
  }

  async function emailMe(id) {
    setEmailingMe(id)
    try {
      const r = await fetch(`${API}/admin/partner-accounts/${id}/email-me`, {
        method: 'POST', headers: adminHeaders(),
      })
      if (!r.ok) alert('Failed to send email')
    } catch { alert('Network error') }
    setTimeout(() => setEmailingMe(''), 2000)
  }

  async function deactivatePartner(id, name) {
    if (!confirm(`Deactivate ${name}? This downgrades their account to Free and disables their promo code.`)) return
    setDeactivating(id)
    try {
      const r = await fetch(`${API}/admin/partner-accounts/${id}/deactivate`, {
        method: 'PATCH', headers: adminHeaders(),
      })
      if (r.ok) {
        setPartners(p => p.map(x => x.id === id ? { ...x, user_tier: 'free', discount_code_active: false } : x))
      } else { alert('Failed to deactivate') }
    } catch { alert('Network error') }
    setDeactivating('')
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
      <div className="max-w-6xl mx-auto px-4 py-8">

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

        {/* Astrologer contacts table */}
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
                {list.map((a, i) => {
                  const alreadyPartner = !!madeIds[a.id] || partners.some(p => p.contact_email === a.email)
                  return (
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
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(a)} className="px-3 py-1 rounded text-xs font-semibold"
                              style={{ background: '#1e2d45', color: '#e2e8f0' }}>Edit</button>
                            <button onClick={() => del(a.id)} disabled={deleting === a.id} className="px-3 py-1 rounded text-xs font-semibold"
                              style={{ background: '#2d0a0a', color: '#f87171' }}>
                              {deleting === a.id ? '…' : 'Delete'}
                            </button>
                            {alreadyPartner ? (
                              <span className="px-3 py-1 rounded text-xs font-semibold"
                                style={{ background: '#0a2e1a', color: '#4ade80' }}>
                                Partner ✓
                              </span>
                            ) : (
                              <button
                                onClick={() => makePartner(a)}
                                disabled={making[a.id] || !a.email}
                                className="px-3 py-1 rounded text-xs font-semibold"
                                title={!a.email ? 'Add an email first' : 'Create partner account'}
                                style={{
                                  background: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
                                  color: '#fff',
                                  opacity: (making[a.id] || !a.email) ? 0.5 : 1,
                                  cursor: !a.email ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {making[a.id] ? '…' : 'Create Partner Account'}
                              </button>
                            )}
                          </div>
                          {makeErr[a.id] && (
                            <p className="text-xs" style={{ color: '#f87171' }}>{makeErr[a.id]}</p>
                          )}
                          {madeIds[a.id] && (
                            <div className="mt-3 rounded-lg p-3 text-xs space-y-2" style={{ background: '#0a2e1a', border: '1px solid #166534' }}>
                              <p className="font-semibold" style={{ color: '#4ade80' }}>Account created!</p>
                              <div>
                                <span style={{ color: '#94a3b8' }}>Promo code: </span>
                                <strong style={{ color: '#06b6d4' }}>{madeIds[a.id].discount_code}</strong>
                                <CopyButton text={madeIds[a.id].discount_code} />
                              </div>
                              <div>
                                <span style={{ color: '#94a3b8' }}>Referral link: </span>
                                <span style={{ color: '#e2e8f0' }}>starsignal.io/join/{madeIds[a.id].slug}</span>
                                <CopyButton text={`https://starsignal.io/join/${madeIds[a.id].slug}`} />
                              </div>
                              <button
                                onClick={() => emailMe(madeIds[a.id].id)}
                                disabled={!!emailingMe}
                                className="mt-1 px-3 py-1.5 rounded text-xs font-semibold w-full"
                                style={{ background: emailingMe === madeIds[a.id].id ? '#1e3a5f' : '#06b6d4', color: '#fff', cursor: 'pointer', border: 'none' }}>
                                {emailingMe === madeIds[a.id].id ? 'Sent to your Gmail ✓' : 'Email me the template'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Partner Accounts table */}
        <div className="mt-12 pt-8" style={{ borderTop: '1px solid #1e2d45' }}>
          <div className="mb-5">
            <h2 className="text-lg font-black" style={{ color: '#f1f5f9' }}>Partner Accounts</h2>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Accounts with permanent partner access</p>
          </div>

          {partnersLoading ? (
            <p className="text-sm" style={{ color: '#94a3b8' }}>Loading…</p>
          ) : partners.length === 0 ? (
            <div className="rounded-xl p-10 text-center" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
              <p className="text-sm" style={{ color: '#94a3b8' }}>No partner accounts yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #1e2d45' }}>
              <table className="w-full text-sm" style={{ minWidth: '1060px' }}>
                <thead>
                  <tr style={{ background: '#0b1120', borderBottom: '1px solid #1e2d45' }}>
                    {['Name', 'Email', 'Publication', 'Promo Code', 'Referral Link', 'Created', 'Last Login', 'Clicks', 'Signups', 'Commission', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? '#070c18' : '#0b1120', borderBottom: '1px solid #1e2d45' }}>
                      <td className="px-4 py-3">
                        <div className="font-semibold" style={{ color: '#f1f5f9' }}>{p.name}</div>
                        {p.user_tier === 'partner_preview' ? (
                          <span className="text-xs" style={{ color: '#22d3ee' }}>Partner</span>
                        ) : (
                          <span className="text-xs" style={{ color: '#f87171' }}>Deactivated</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{p.contact_email}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{p.publication_name || '—'}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono px-2 py-0.5 rounded"
                          style={{ background: '#0f1a2e', color: '#06b6d4' }}>{p.discount_code || '—'}</code>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#64748b' }}>{p.referral_link || '—'}</span>
                        {p.referral_link && <CopyButton text={`https://${p.referral_link}`} />}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmt(p.created_at)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmt(p.last_login)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#e2e8f0' }}>{p.referral_click_count ?? 0}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#e2e8f0' }}>{p.referred_signups ?? 0}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#4ade80' }}>
                        ${(p.total_commission_earned ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => emailMe(p.id)}
                            disabled={emailingMe === p.id}
                            className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                            style={{ background: emailingMe === p.id ? '#14532d' : '#06b6d4', color: '#fff', border: 'none' }}
                          >
                            {emailingMe === p.id ? 'Sent ✓' : 'Email me'}
                          </button>
                          <button
                            onClick={() => resendWelcome(p.id)}
                            disabled={resending === p.id}
                            className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                            style={{ background: '#0f1a2e', color: '#94a3b8', border: '1px solid #1e2d45' }}
                          >
                            {resending === p.id ? '…' : 'Resend to them'}
                          </button>
                          {p.user_tier !== 'free' && (
                            <button
                              onClick={() => deactivatePartner(p.id, p.name)}
                              disabled={deactivating === p.id}
                              className="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                              style={{ background: '#2d0a0a', color: '#f87171' }}
                            >
                              {deactivating === p.id ? '…' : 'Deactivate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Astrologer modal */}
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
