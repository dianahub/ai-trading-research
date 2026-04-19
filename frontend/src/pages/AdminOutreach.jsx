import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PLATFORMS = ['youtube', 'substack', 'twitter', 'tiktok', 'instagram']
const STATUSES  = ['new', 'drafted', 'sent', 'responded', 'partner', 'declined']

const STATUS_STYLE = {
  new:       { bg: '#1f2937', color: '#9ca3af', label: 'New' },
  drafted:   { bg: '#1e3a5f', color: '#60a5fa', label: 'Drafted' },
  sent:      { bg: '#431407', color: '#fb923c', label: 'Sent' },
  responded: { bg: '#1e1b4b', color: '#a78bfa', label: 'Responded' },
  partner:   { bg: '#052e16', color: '#34d399', label: 'Partner' },
  declined:  { bg: '#450a0a', color: '#f87171', label: 'Declined' },
}

function Badge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.new
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>{s.label}</span>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handle}
      className="px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer"
      style={{ background: copied ? '#052e16' : '#1e2d45', color: copied ? '#34d399' : '#94a3b8', border: `1px solid ${copied ? '#065f46' : '#1e3a5f'}` }}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function Modal({ onClose, children }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl"
        style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
        {children}
      </div>
    </div>
  )
}

export default function AdminOutreach() {
  const [authed, setAuthed]         = useState(() => !!sessionStorage.getItem('admin_email'))
  const [authForm, setAuthForm]     = useState({ email: sessionStorage.getItem('admin_email') || '', password: sessionStorage.getItem('admin_pw') || '' })
  const [authError, setAuthError]   = useState('')

  const [mode, setMode]             = useState('partners') // 'partners' | 'apileads'
  const [tab, setTab]               = useState('discover')
  const [contacts, setContacts]     = useState([])
  const [followUps, setFollowUps]   = useState([])
  const [analytics, setAnalytics]   = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  // Discover tab
  const [keyword, setKeyword]       = useState('')
  const [platform, setPlatform]     = useState('youtube')
  const [searching, setSearching]   = useState(false)
  const [results, setResults]       = useState([])
  const [searchError, setSearchError] = useState('')
  const [addedIds, setAddedIds]     = useState(new Set())

  // Message modal
  const [msgModal, setMsgModal]     = useState(null)  // { contact }
  const [messages, setMessages]     = useState(null)  // { initial, followup, upgrade }
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgTab, setMsgTab]         = useState('initial')
  const [msgEdits, setMsgEdits]     = useState({})

  // Edit modal
  const [editModal, setEditModal]   = useState(null)
  const [editForm, setEditForm]     = useState({})
  const [saving, setSaving]         = useState(false)

  // Add prospect modal
  const [addModal, setAddModal]     = useState(null)  // prospect from search results

  const adminHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'x-admin-email':    sessionStorage.getItem('admin_email') || '',
    'x-admin-password': sessionStorage.getItem('admin_pw')    || '',
  }), [])

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleLogin = async e => {
    e.preventDefault()
    setAuthError('')
    try {
      const res = await fetch(`${API}/signups`, {
        headers: { 'x-admin-email': authForm.email, 'x-admin-password': authForm.password }
      })
      if (res.status === 401) { setAuthError('Invalid credentials'); return }
      sessionStorage.setItem('admin_email', authForm.email)
      sessionStorage.setItem('admin_pw',    authForm.password)
      setAuthed(true)
    } catch { setAuthError('Connection failed') }
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadContacts = useCallback(async () => {
    const res = await fetch(`${API}/outreach`, { headers: adminHeaders() })
    if (res.ok) {
      const data = await res.json()
      setContacts(data.contacts)
    }
  }, [adminHeaders])

  const loadFollowUps = useCallback(async () => {
    const res = await fetch(`${API}/outreach/follow-ups`, { headers: adminHeaders() })
    if (res.ok) {
      const data = await res.json()
      setFollowUps(data.follow_ups)
    }
  }, [adminHeaders])

  const loadAnalytics = useCallback(async () => {
    const res = await fetch(`${API}/outreach/analytics`, { headers: adminHeaders() })
    if (res.ok) setAnalytics(await res.json())
  }, [adminHeaders])

  useEffect(() => {
    if (!authed) return
    loadContacts()
    loadFollowUps()
    loadAnalytics()
  }, [authed, loadContacts, loadFollowUps, loadAnalytics])

  // ── Discover ──────────────────────────────────────────────────────────────

  const handleSearch = async e => {
    e.preventDefault()
    if (!keyword.trim()) return
    setSearching(true)
    setResults([])
    setSearchError('')
    try {
      const res = await fetch(`${API}/outreach/search`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ keyword: keyword.trim(), platform }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Search failed')
      setResults(data.prospects || [])
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const handleAddToList = async prospect => {
    const key = `${prospect.name}:${prospect.platform}`
    try {
      const res = await fetch(`${API}/outreach`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          name:          prospect.name,
          platform:      prospect.platform,
          follower_count: prospect.follower_count || '',
          profile_url:   prospect.profile_url   || '',
          contact_email: prospect.contact_email  || '',
          content_focus: prospect.content_focus  || '',
        }),
      })
      if (res.ok) {
        setAddedIds(prev => new Set([...prev, key]))
        loadContacts()
        loadAnalytics()
      }
    } catch {}
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  const openMsgModal = async contact => {
    setMsgModal(contact)
    setMessages(null)
    setMsgEdits({})
    setMsgTab('initial')
    setMsgLoading(true)
    try {
      const res = await fetch(`${API}/outreach/${contact.id}/generate-messages`, {
        method: 'POST', headers: adminHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setMessages(data)
      setMsgEdits({
        subject:          data.subject ?? '',
        initial:          data.initial ?? '',
        followup:         data.followup ?? '',
        upgrade:          data.upgrade ?? '',
        interest_followup: data.interest_followup ?? '',
      })
    } catch (err) {
      setMessages({ error: err.message })
    } finally {
      setMsgLoading(false)
    }
  }

  // ── Send email ────────────────────────────────────────────────────────────

  const [sendingEmail, setSendingEmail] = useState(null)
  const [emailSent, setEmailSent]       = useState(new Set())

  const handleSendEmail = async (contact, message) => {
    setSendingEmail(contact.id)
    try {
      const lines  = message.split('\n')
      const subject = lines[0].startsWith('Subject:') ? lines[0].replace('Subject:', '').trim() : ''
      const body    = subject ? lines.slice(1).join('\n').trim() : message
      const res = await fetch(`${API}/outreach/${contact.id}/send-email`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ message: body, subject }),
      })
      if (res.ok) {
        setEmailSent(prev => new Set([...prev, contact.id]))
        loadContacts()
      }
    } finally {
      setSendingEmail(null)
    }
  }

  // ── Referral ──────────────────────────────────────────────────────────────

  const [generatingRef, setGeneratingRef] = useState(null)

  const handleGenerateReferral = async contact => {
    setGeneratingRef(contact.id)
    try {
      const res = await fetch(`${API}/outreach/${contact.id}/generate-referral`, {
        method: 'POST', headers: adminHeaders(),
      })
      if (res.ok) { loadContacts(); loadAnalytics() }
    } finally {
      setGeneratingRef(null)
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  const openEdit = contact => {
    setEditModal(contact)
    setEditForm({
      name:          contact.name,
      platform:      contact.platform,
      follower_count: contact.follower_count,
      profile_url:   contact.profile_url,
      contact_email: contact.contact_email,
      content_focus: contact.content_focus,
      status:        contact.status,
      notes:         contact.notes,
    })
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/outreach/${editModal.id}`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify(editForm),
      })
      if (res.ok) { loadContacts(); loadAnalytics(); setEditModal(null) }
    } finally { setSaving(false) }
  }

  const handleDelete = async contact => {
    if (!confirm(`Delete ${contact.name}?`)) return
    await fetch(`${API}/outreach/${contact.id}`, { method: 'DELETE', headers: adminHeaders() })
    loadContacts()
    loadAnalytics()
  }

  const handleMarkSent = async (contact, messageTab) => {
    await fetch(`${API}/outreach/${contact.id}`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({
        status: 'sent',
        last_message_sent: messageTab || 'initial',
        date_contacted: new Date().toISOString(),
      }),
    })
    loadContacts()
    loadFollowUps()
  }

  const handleMarkResponded = async contact => {
    await fetch(`${API}/outreach/${contact.id}`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ status: 'responded', date_responded: new Date().toISOString() }),
    })
    loadContacts()
    loadFollowUps()
    loadAnalytics()
  }

  // ── Login screen ──────────────────────────────────────────────────────────

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b16' }}>
      <form onSubmit={handleLogin} className="w-full max-w-sm p-8 rounded-xl space-y-4"
        style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
        <div>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
            <span className="text-white text-xs font-bold">AI</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#f1f5f9' }}>Outreach Admin</h1>
          <p className="text-xs mt-1" style={{ color: '#64748b' }}>Starsignal.io</p>
        </div>
        {authError && (
          <p className="text-sm" style={{ color: '#f87171' }}>{authError}</p>
        )}
        <input type="email" placeholder="Admin email" required value={authForm.email}
          onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
        <input type="password" placeholder="Password" required value={authForm.password}
          onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
        <button type="submit" className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff' }}>
          Sign In
        </button>
      </form>
    </div>
  )

  // ── Follow-up ids for badge ───────────────────────────────────────────────

  const followUpIds = new Set(followUps.map(c => c.id))

  const filteredContacts = statusFilter === 'all'
    ? contacts
    : contacts.filter(c => c.status === statusFilter)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#070b16', color: '#e2e8f0' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-3"
        style={{ background: '#0a0e1a', borderBottom: '1px solid #1e2d45' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <span className="text-sm font-bold tracking-widest text-white">Starsignal.io</span>
            </Link>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1e2d45', color: '#64748b' }}>
              Outreach Admin
            </span>
          </div>
          <button onClick={() => { sessionStorage.clear(); setAuthed(false) }}
            className="text-xs cursor-pointer" style={{ color: '#475569' }}>
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Mode toggle */}
        <div className="flex items-center gap-3 mb-6">
          {[
            { id: 'partners', label: '✦ Astrologer Partners' },
            { id: 'apileads', label: '⚡ API Leads' },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
              style={{
                background: mode === m.id ? 'linear-gradient(135deg,#06b6d4,#3b82f6)' : '#0f1a2e',
                border: `1px solid ${mode === m.id ? '#06b6d4' : '#1e2d45'}`,
                color: mode === m.id ? '#fff' : '#64748b',
              }}>
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'apileads' && <ApiLeadsSection API={API} adminHeaders={adminHeaders} />}

        {mode === 'partners' && <>
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
          style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
          {[
            { id: 'discover',  label: '🔍 Discover' },
            { id: 'contacts',  label: `📋 Contacts${contacts.length ? ` (${contacts.length})` : ''}` },
            { id: 'analytics', label: '📊 Analytics' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
              style={{
                background: tab === t.id ? '#1e3a5f' : 'transparent',
                color:      tab === t.id ? '#e2e8f0'  : '#64748b',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DISCOVER TAB ── */}
        {tab === 'discover' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
              <h2 className="text-base font-semibold mb-4" style={{ color: '#f1f5f9' }}>
                Find Prospects
              </h2>
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder='e.g. "financial astrology" or "mundane astrology"'
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }}
                />
                <select value={platform} onChange={e => setPlatform(e.target.value)}
                  className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }}>
                  {PLATFORMS.map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
                <button type="submit" disabled={searching || !keyword.trim()}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff' }}>
                  {searching ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Searching…
                    </span>
                  ) : 'Search'}
                </button>
              </form>
            </div>

            {searchError && (
              <div className="p-4 rounded-xl text-sm" style={{ background: '#450a0a', color: '#f87171', border: '1px solid #7f1d1d' }}>
                {searchError}
              </div>
            )}

            {searching && (
              <div className="p-6 rounded-xl flex items-center gap-3"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm" style={{ color: '#94a3b8' }}>
                  Claude is searching the web for {platform} creators matching "{keyword}"…
                </span>
              </div>
            )}

            {!searching && !searchError && results.length === 0 && keyword && (
              <div className="p-6 rounded-xl text-center text-sm" style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#475569' }}>
                No results returned. Try a different keyword or platform.
              </div>
            )}

            {results.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d45' }}>
                <div className="px-4 py-3" style={{ background: '#111827', borderBottom: '1px solid #1e2d45' }}>
                  <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>
                    {results.length} prospects found
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                        {['Name', 'Platform', 'Followers', 'Content Focus', 'Contact', ''].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest"
                            style={{ color: '#475569', background: '#0f1a2e' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => {
                        const key     = `${r.name}:${r.platform}`
                        const added   = addedIds.has(key)
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #1e2d45', background: '#0a0e1a' }}>
                            <td className="px-4 py-3">
                              <div className="font-medium" style={{ color: '#f1f5f9' }}>{r.name}</div>
                              {r.profile_url && (
                                <a href={r.profile_url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs hover:underline" style={{ color: '#06b6d4' }}>
                                  View profile ↗
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: '#1e2d45', color: '#94a3b8' }}>
                                {r.platform}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs" style={{ color: '#94a3b8' }}>
                              {r.follower_count || '—'}
                            </td>
                            <td className="px-4 py-3 max-w-xs" style={{ color: '#94a3b8' }}>
                              <span className="line-clamp-2 text-xs">{r.content_focus}</span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {r.contact_email
                                ? <a href={`mailto:${r.contact_email}`} style={{ color: '#06b6d4', textDecoration: 'none' }}
                                    title="Click to email">{r.contact_email}</a>
                                : <span style={{ color: '#334155' }}>—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleAddToList(r)}
                                disabled={added}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all"
                                style={{
                                  background: added ? '#052e16' : 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                                  color: added ? '#34d399' : '#fff',
                                }}>
                                {added ? '✓ Added' : '+ Add to List'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONTACTS TAB ── */}
        {tab === 'contacts' && (
          <div className="space-y-4">
            {/* Follow-up alerts */}
            {followUps.length > 0 && (
              <div className="p-4 rounded-xl flex items-start gap-3"
                style={{ background: '#1c1400', border: '1px solid #854d0e' }}>
                <span className="text-lg">⏰</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
                    {followUps.length} follow-up{followUps.length > 1 ? 's' : ''} due
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>
                    {followUps.map(c => c.name).join(', ')} — no response after 5+ days
                  </p>
                </div>
              </div>
            )}

            {/* Status filter */}
            <div className="flex gap-2 flex-wrap">
              {['all', ...STATUSES].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all"
                  style={{
                    background: statusFilter === s ? '#1e3a5f' : '#0f1a2e',
                    color:      statusFilter === s ? '#e2e8f0'  : '#64748b',
                    border: `1px solid ${statusFilter === s ? '#1e3a5f' : '#1e2d45'}`,
                  }}>
                  {s === 'all' ? `All (${contacts.length})` : `${STATUS_STYLE[s]?.label} (${contacts.filter(c => c.status === s).length})`}
                </button>
              ))}
            </div>

            {filteredContacts.length === 0 && (
              <div className="p-12 rounded-xl text-center" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                <p className="text-sm" style={{ color: '#475569' }}>
                  {contacts.length === 0 ? 'No contacts yet. Use Discover to find prospects.' : 'No contacts with this status.'}
                </p>
              </div>
            )}

            {filteredContacts.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d45' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                        {['Name', 'Platform', 'Followers', 'Status', 'Contacted', 'Referrals', 'Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest"
                            style={{ color: '#475569', background: '#0f1a2e' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map(c => {
                        const needsFollowUp = followUpIds.has(c.id)
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid #1e2d45', background: '#0a0e1a' }}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium" style={{ color: '#f1f5f9' }}>{c.name}</span>
                                {needsFollowUp && (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                                    style={{ background: '#1c1400', color: '#fbbf24', border: '1px solid #854d0e' }}>
                                    Follow Up
                                  </span>
                                )}
                              </div>
                              {c.last_message_sent && (
                                <div className="text-xs mt-0.5" style={{ color: '#475569' }}>
                                  Last sent: <span style={{ color: '#94a3b8' }}>{c.last_message_sent.replace(/_/g, ' ')}</span>
                                </div>
                              )}
                              {c.profile_url && (
                                <a href={c.profile_url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs hover:underline" style={{ color: '#06b6d4' }}>
                                  {c.profile_url.length > 35 ? c.profile_url.slice(0, 35) + '…' : c.profile_url}
                                </a>
                              )}
                              {c.contact_email && (
                                <div className="mt-0.5">
                                  <a href={`mailto:${c.contact_email}`} className="text-xs"
                                    style={{ color: '#34d399', textDecoration: 'none' }}>
                                    ✉ {c.contact_email}
                                  </a>
                                </div>
                              )}
                              {c.referral_code && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-xs font-mono" style={{ color: '#34d399' }}>
                                    ?ref={c.referral_code}
                                  </span>
                                  <CopyButton text={`https://starsignal.io?ref=${c.referral_code}`} />
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: '#1e2d45', color: '#94a3b8' }}>
                                {c.platform}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs" style={{ color: '#94a3b8' }}>
                              {c.follower_count || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <Badge status={c.status} />
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>
                              {c.date_contacted ? new Date(c.date_contacted).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs font-mono" style={{ color: '#94a3b8' }}>
                              {c.referred_signups || 0}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 flex-wrap">
                                <button onClick={() => openMsgModal(c)}
                                  className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all"
                                  style={{ background: '#1e1b4b', color: '#a78bfa', border: '1px solid #3730a3' }}>
                                  Generate
                                </button>
                                {c.contact_email && (
                                  <button
                                    onClick={() => handleSendEmail(c, '')}
                                    disabled={sendingEmail === c.id || emailSent.has(c.id)}
                                    className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer disabled:opacity-50"
                                    style={{ background: '#052e16', color: '#34d399', border: '1px solid #065f46' }}>
                                    {sendingEmail === c.id ? '…' : emailSent.has(c.id) ? 'Sent ✓' : 'Email'}
                                  </button>
                                )}
                                {c.status !== 'partner' && (
                                  <button onClick={() => handleGenerateReferral(c)}
                                    disabled={generatingRef === c.id}
                                    className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer disabled:opacity-50"
                                    style={{ background: '#431407', color: '#fb923c', border: '1px solid #7c2d12' }}>
                                    {generatingRef === c.id ? '…' : 'Partner'}
                                  </button>
                                )}
                                {c.status !== 'sent' && c.status !== 'partner' && c.status !== 'responded' && (
                                  <button onClick={() => handleMarkSent(c, 'initial')}
                                    className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
                                    style={{ background: '#1e2d45', color: '#94a3b8', border: '1px solid #1e2d45' }}>
                                    Mark Sent
                                  </button>
                                )}
                                {c.status === 'sent' && (
                                  <button onClick={() => handleMarkResponded(c)}
                                    className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
                                    style={{ background: '#1e1b4b', color: '#a78bfa', border: '1px solid #3730a3' }}>
                                    Responded
                                  </button>
                                )}
                                <button onClick={() => openEdit(c)}
                                  className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
                                  style={{ background: '#1e2d45', color: '#64748b', border: '1px solid #1e2d45' }}>
                                  Edit
                                </button>
                                <button onClick={() => handleDelete(c)}
                                  className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
                                  style={{ background: 'transparent', color: '#ef4444', border: '1px solid #450a0a' }}>
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && analytics && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Prospects',  value: analytics.total_prospects },
                { label: 'Messages Sent',    value: analytics.messages_sent },
                { label: 'Response Rate',    value: `${analytics.response_rate}%` },
                { label: 'Conversion Rate',  value: `${analytics.conversion_rate}%` },
                { label: 'Partners',         value: analytics.partners },
                { label: 'Responses',        value: analytics.responses },
                { label: 'Declined',         value: analytics.declined },
                { label: 'Referred Signups', value: analytics.total_referred_signups },
              ].map(s => (
                <div key={s.label} className="p-4 rounded-xl"
                  style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                  <div className="text-2xl font-bold" style={{ color: '#06b6d4' }}>{s.value}</div>
                  <div className="text-xs mt-1" style={{ color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Platform breakdown */}
            {Object.keys(analytics.by_platform).length > 0 && (
              <div className="p-5 rounded-xl" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: '#f1f5f9' }}>
                  Performance by Platform
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                        {['Platform', 'Prospects', 'Contacted', 'Responded', 'Partners', 'Response %'].map(h => (
                          <th key={h} className="text-left pb-3 pr-6 text-xs font-semibold uppercase tracking-widest"
                            style={{ color: '#475569' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(analytics.by_platform)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([p, s]) => (
                          <tr key={p} style={{ borderBottom: '1px solid #1e2d45' }}>
                            <td className="py-2.5 pr-6">
                              <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: '#1e2d45', color: '#94a3b8' }}>
                                {p}
                              </span>
                            </td>
                            <td className="py-2.5 pr-6 font-mono text-xs" style={{ color: '#94a3b8' }}>{s.total}</td>
                            <td className="py-2.5 pr-6 font-mono text-xs" style={{ color: '#94a3b8' }}>{s.sent}</td>
                            <td className="py-2.5 pr-6 font-mono text-xs" style={{ color: '#94a3b8' }}>{s.responded}</td>
                            <td className="py-2.5 pr-6 font-mono text-xs" style={{ color: '#34d399' }}>{s.partners}</td>
                            <td className="py-2.5 pr-6 font-mono text-xs" style={{ color: '#06b6d4' }}>
                              {s.sent > 0 ? `${Math.round(s.responded / s.sent * 100)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'analytics' && !analytics && (
          <div className="p-12 text-center" style={{ color: '#475569' }}>Loading analytics…</div>
        )}
        </>}
      </main>

      {/* ── Message modal ── */}
      {msgModal && (
        <Modal onClose={() => { setMsgModal(null); setMessages(null) }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold" style={{ color: '#f1f5f9' }}>
                  Messages for {msgModal.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                  {msgModal.platform} · {msgModal.follower_count}
                </p>
              </div>
              <button onClick={() => { setMsgModal(null); setMessages(null) }}
                className="text-lg cursor-pointer" style={{ color: '#475569' }}>✕</button>
            </div>

            {msgLoading && (
              <div className="py-12 flex flex-col items-center gap-3">
                <span className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm" style={{ color: '#94a3b8' }}>
                  Claude is reading their profile and writing personalised messages…
                </p>
              </div>
            )}

            {messages?.error && (
              <p className="text-sm" style={{ color: '#f87171' }}>{messages.error}</p>
            )}

            {messages && !messages.error && !msgLoading && (
              <>
                {/* Message tabs */}
                <div className="flex flex-wrap gap-1 mb-4 p-1 rounded-lg w-fit"
                  style={{ background: '#111827', border: '1px solid #1e2d45' }}>
                  {[
                    { id: 'initial',           label: '1st Outreach' },
                    { id: 'followup',          label: 'Follow-Up' },
                    { id: 'upgrade',           label: 'Partner Pitch' },
                    ...(messages.interest_followup ? [{ id: 'interest_followup', label: '💬 Interested (TikTok)' }] : []),
                  ].map(t => (
                    <button key={t.id} onClick={() => setMsgTab(t.id)}
                      className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-all"
                      style={{
                        background: msgTab === t.id ? '#1e3a5f' : 'transparent',
                        color:      msgTab === t.id ? '#e2e8f0'  : '#64748b',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Subject line — shown for 1st Outreach tab */}
                {msgTab === 'initial' && messages.subject && (
                  <div className="mb-3">
                    <div className="text-xs font-medium mb-1" style={{ color: '#475569' }}>Subject</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={msgEdits.subject ?? messages.subject}
                        onChange={e => setMsgEdits(prev => ({ ...prev, subject: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }}
                      />
                      <CopyButton text={msgEdits.subject ?? messages.subject} />
                    </div>
                  </div>
                )}

                <textarea
                  rows={10}
                  value={msgEdits[msgTab] || ''}
                  onChange={e => setMsgEdits(prev => ({ ...prev, [msgTab]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-y"
                  style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0', lineHeight: '1.6' }}
                />

                <div className="flex items-center gap-2 mt-3">
                  <CopyButton text={msgEdits[msgTab] || ''} />
                  {msgModal.contact_email && (
                    <button
                      onClick={() => handleSendEmail(msgModal, msgEdits[msgTab] || '')}
                      disabled={sendingEmail === msgModal.id}
                      className="px-3 py-1 rounded text-xs font-medium cursor-pointer disabled:opacity-50"
                      style={{ background: '#052e16', color: '#34d399', border: '1px solid #065f46' }}>
                      {sendingEmail === msgModal.id ? 'Sending…' : 'Send via Email'}
                    </button>
                  )}
                  {!msgModal.referral_code && (
                    <button onClick={() => handleGenerateReferral(msgModal)}
                      disabled={generatingRef === msgModal.id}
                      className="px-3 py-1 rounded text-xs font-medium cursor-pointer disabled:opacity-50"
                      style={{ background: '#431407', color: '#fb923c', border: '1px solid #7c2d12' }}>
                      {generatingRef === msgModal.id ? '…' : 'Make Partner + Get Link'}
                    </button>
                  )}
                  {msgModal.referral_code && (
                    <span className="text-xs font-mono" style={{ color: '#34d399' }}>
                      Referral: starsignal.io?ref={msgModal.referral_code}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button onClick={() => { handleMarkSent(msgModal, msgTab); setMsgModal(null) }}
                    className="px-3 py-1 rounded text-xs font-medium cursor-pointer"
                    style={{ background: '#1e2d45', color: '#94a3b8', border: '1px solid #1e2d45' }}>
                    Mark "{msgTab.replace('_', ' ')}" as Sent
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editModal && (
        <Modal onClose={() => setEditModal(null)}>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: '#f1f5f9' }}>Edit Contact</h3>
              <button onClick={() => setEditModal(null)} className="cursor-pointer" style={{ color: '#475569' }}>✕</button>
            </div>

            {[
              { key: 'name',          label: 'Name',          type: 'text'  },
              { key: 'follower_count', label: 'Followers',     type: 'text'  },
              { key: 'profile_url',   label: 'Profile URL',   type: 'text'  },
              { key: 'contact_email', label: 'Email',         type: 'email' },
              { key: 'content_focus', label: 'Content Focus', type: 'text'  },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs mb-1" style={{ color: '#64748b' }}>{f.label}</label>
                <input type={f.type} value={editForm[f.key] || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
              </div>
            ))}

            <div>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Platform</label>
              <select value={editForm.platform || ''}
                onChange={e => setEditForm(prev => ({ ...prev, platform: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Status</label>
              <select value={editForm.status || ''}
                onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Notes</label>
              <textarea rows={3} value={editForm.notes || ''}
                onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={handleSaveEdit} disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditModal(null)}
                className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                style={{ background: '#1e2d45', color: '#64748b' }}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── API Leads Section ──────────────────────────────────────────────────────────

const LEAD_PLATFORMS  = ['github', 'indiehackers', 'producthunt', 'crunchbase', 'jobpost']
const LEAD_STATUSES   = ['new', 'drafted', 'sent', 'responded', 'trialing', 'paying', 'declined']
const JOB_STATUSES    = ['quoted', 'accepted', 'in_progress', 'complete', 'paid']

const LEAD_STATUS_STYLE = {
  new:       { bg: '#1f2937', color: '#9ca3af' },
  drafted:   { bg: '#1e3a5f', color: '#60a5fa' },
  sent:      { bg: '#431407', color: '#fb923c' },
  responded: { bg: '#1e1b4b', color: '#a78bfa' },
  trialing:  { bg: '#0c2a1a', color: '#34d399' },
  paying:    { bg: '#052e16', color: '#4ade80' },
  declined:  { bg: '#450a0a', color: '#f87171' },
}

function LeadBadge({ status }) {
  const s = LEAD_STATUS_STYLE[status] || LEAD_STATUS_STYLE.new
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>{status}</span>
}

function ApiLeadsSection({ API, adminHeaders }) {
  const [tab, setTab]               = useState('discover')
  const [leads, setLeads]           = useState([])
  const [jobs, setJobs]             = useState([])
  const [combinedAnalytics, setCombined] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  // Discover
  const [keyword, setKeyword]       = useState('')
  const [platform, setPlatform]     = useState('github')
  const [searching, setSearching]   = useState(false)
  const [results, setResults]       = useState([])
  const [searchError, setSearchError] = useState('')
  const [addedIds, setAddedIds]     = useState(new Set())

  // Message modal
  const [msgModal, setMsgModal]     = useState(null)
  const [messages, setMessages]     = useState(null)
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgTab, setMsgTab]         = useState('cold_outreach')
  const [msgEdits, setMsgEdits]     = useState({})
  const [sendingEmail, setSendingEmail] = useState(null)

  // Edit lead modal
  const [editModal, setEditModal]   = useState(null)
  const [editForm, setEditForm]     = useState({})
  const [saving, setSaving]         = useState(false)

  // Service job modal
  const [jobModal, setJobModal]     = useState(null) // null | 'new' | job object
  const [jobForm, setJobForm]       = useState({ company_name: '', scope: '', quoted_price: '', status: 'quoted', hours_spent: '', notes: '' })
  const [savingJob, setSavingJob]   = useState(false)

  const loadLeads = useCallback(async () => {
    const res = await fetch(`${API}/api-leads`, { headers: adminHeaders() })
    if (res.ok) { const d = await res.json(); setLeads(d.leads || []) }
  }, [API, adminHeaders])

  const loadJobs = useCallback(async () => {
    const res = await fetch(`${API}/service-jobs`, { headers: adminHeaders() })
    if (res.ok) { const d = await res.json(); setJobs(d.jobs || []) }
  }, [API, adminHeaders])

  const loadCombined = useCallback(async () => {
    const res = await fetch(`${API}/combined-analytics`, { headers: adminHeaders() })
    if (res.ok) setCombined(await res.json())
  }, [API, adminHeaders])

  useEffect(() => {
    loadLeads(); loadJobs(); loadCombined()
  }, [loadLeads, loadJobs, loadCombined])

  async function handleSearch(e) {
    e.preventDefault()
    setSearching(true); setResults([]); setSearchError('')
    try {
      const res = await fetch(`${API}/api-leads/search`, {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ keyword, platform }),
      })
      const data = await res.json()
      if (!res.ok) { setSearchError(data.detail || 'Search failed'); return }
      setResults(data.leads || [])
    } catch { setSearchError('Network error') }
    finally { setSearching(false) }
  }

  async function handleAddLead(lead) {
    const res = await fetch(`${API}/api-leads`, {
      method: 'POST', headers: adminHeaders(), body: JSON.stringify(lead),
    })
    if (res.ok) { setAddedIds(s => new Set([...s, lead.profile_url])); loadLeads() }
  }

  async function openMsgModal(lead) {
    setMsgModal(lead); setMessages(null); setMsgEdits({}); setMsgTab('cold_outreach'); setMsgLoading(true)
    try {
      const res = await fetch(`${API}/api-leads/${lead.id}/generate-messages`, { method: 'POST', headers: adminHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setMessages(data)
      setMsgEdits({ subject: data.subject || '', cold_outreach: data.cold_outreach || '', follow_up: data.follow_up || '', implementation_offer: data.implementation_offer || '' })
    } catch (err) { setMessages({ error: err.message }) }
    finally { setMsgLoading(false) }
  }

  async function handleMarkSent(lead, tab) {
    await fetch(`${API}/api-leads/${lead.id}`, {
      method: 'PATCH', headers: adminHeaders(),
      body: JSON.stringify({ status: 'sent', last_message_sent: tab || 'cold_outreach', date_contacted: new Date().toISOString() }),
    })
    loadLeads()
  }

  async function handleSendEmail(lead, message) {
    if (!lead.contact_email) return
    setSendingEmail(lead.id)
    try {
      await fetch(`${API}/outreach/${lead.id}/send-email`, {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({ message, subject: msgEdits.subject || '' }),
      })
    } finally { setSendingEmail(null) }
  }

  function openEditModal(lead) {
    setEditModal(lead)
    setEditForm({ ...lead })
  }

  async function handleSaveEdit() {
    setSaving(true)
    await fetch(`${API}/api-leads/${editModal.id}`, {
      method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(editForm),
    })
    setSaving(false); setEditModal(null); loadLeads()
  }

  async function handleDeleteLead(lead) {
    if (!confirm(`Delete ${lead.company_name}?`)) return
    await fetch(`${API}/api-leads/${lead.id}`, { method: 'DELETE', headers: adminHeaders() })
    loadLeads()
  }

  async function handleSaveJob() {
    setSavingJob(true)
    const payload = { ...jobForm, quoted_price: parseInt(jobForm.quoted_price) || 0, hours_spent: parseInt(jobForm.hours_spent) || 0 }
    if (jobModal === 'new') {
      await fetch(`${API}/service-jobs`, { method: 'POST', headers: adminHeaders(), body: JSON.stringify(payload) })
    } else {
      await fetch(`${API}/service-jobs/${jobModal.id}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(payload) })
    }
    setSavingJob(false); setJobModal(null); loadJobs(); loadCombined()
  }

  async function handleDeleteJob(job) {
    if (!confirm(`Delete job for ${job.company_name}?`)) return
    await fetch(`${API}/service-jobs/${job.id}`, { method: 'DELETE', headers: adminHeaders() })
    loadJobs(); loadCombined()
  }

  const filteredLeads = statusFilter === 'all' ? leads : leads.filter(l => l.status === statusFilter)
  const ca = combinedAnalytics?.api_leads
  const cs = combinedAnalytics?.services

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
        {[
          { id: 'discover',  label: '🔍 Discover' },
          { id: 'leads',     label: '📋 Leads' + (leads.length ? ' (' + leads.length + ')' : '') },
          { id: 'services',  label: '🔧 Services' + (jobs.length ? ' (' + jobs.length + ')' : '') },
          { id: 'analytics', label: '📊 Analytics' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
            style={{ background: tab === t.id ? '#1e3a5f' : 'transparent', color: tab === t.id ? '#e2e8f0' : '#64748b' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Discover ── */}
      {tab === 'discover' && (
        <div>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 mb-6">
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g. crypto trading dashboard, stock screener, fintech app"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }} />
            <select value={platform} onChange={e => setPlatform(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0' }}>
              {LEAD_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button type="submit" disabled={searching || !keyword.trim()}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', border: 'none' }}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>
          {searchError && <p className="text-sm mb-4" style={{ color: '#f87171' }}>{searchError}</p>}
          {results.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d45' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#0f1a2e', borderBottom: '1px solid #1e2d45' }}>
                    {['Project', 'What they build', 'Tech', 'Stage', 'MRR', 'Email', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#475569' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const added = addedIds.has(r.profile_url)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #1e2d45', background: i % 2 === 0 ? '#070b16' : '#080d18' }}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm" style={{ color: '#f1f5f9' }}>{r.company_name}</div>
                          {r.contact_name && <div className="text-xs" style={{ color: '#475569' }}>{r.contact_name}</div>}
                          {r.profile_url && <a href={r.profile_url} target="_blank" rel="noreferrer" className="text-xs" style={{ color: '#06b6d4' }}>{r.profile_url.replace(/^https?:\/\//, '').slice(0, 40)}</a>}
                        </td>
                        <td className="px-4 py-3 max-w-xs"><span className="text-xs line-clamp-2" style={{ color: '#94a3b8' }}>{r.what_they_build}</span></td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>{r.tech_stack || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>{r.stage || '—'}</td>
                        <td className="px-4 py-3 text-xs font-bold" style={{ color: '#06b6d4' }}>{r.mrr_potential || '—'}</td>
                        <td className="px-4 py-3 text-xs">
                          {r.contact_email ? <a href={`mailto:${r.contact_email}`} style={{ color: '#34d399', textDecoration: 'none' }}>✉ {r.contact_email}</a> : <span style={{ color: '#334155' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleAddLead(r)} disabled={added}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                            style={{ background: added ? '#052e16' : 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: added ? '#34d399' : '#fff' }}>
                            {added ? '✓ Added' : '+ Add'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Leads ── */}
      {tab === 'leads' && (
        <div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {['all', ...LEAD_STATUSES].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-1 rounded-lg text-xs font-medium capitalize cursor-pointer"
                style={{ background: statusFilter === s ? 'linear-gradient(135deg,#06b6d4,#3b82f6)' : '#0f1a2e', border: `1px solid ${statusFilter === s ? '#06b6d4' : '#1e2d45'}`, color: statusFilter === s ? '#fff' : '#64748b' }}>
                {s}
              </button>
            ))}
          </div>
          {filteredLeads.length === 0 ? (
            <p className="text-sm py-12 text-center" style={{ color: '#475569' }}>No leads yet — use Discover to find prospects.</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d45' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#0f1a2e', borderBottom: '1px solid #1e2d45' }}>
                      {['Company', 'Platform', 'What they build', 'Stage', 'MRR', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#475569', background: '#0f1a2e' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #1e2d45', background: '#0a0e1a' }}>
                        <td className="px-4 py-3">
                          <div className="font-medium" style={{ color: '#f1f5f9' }}>{l.company_name}</div>
                          {l.contact_name && <div className="text-xs" style={{ color: '#475569' }}>{l.contact_name}</div>}
                          {l.contact_email && <a href={`mailto:${l.contact_email}`} className="text-xs" style={{ color: '#34d399', textDecoration: 'none' }}>✉ {l.contact_email}</a>}
                          {l.last_message_sent && <div className="text-xs mt-0.5" style={{ color: '#475569' }}>Last: <span style={{ color: '#94a3b8' }}>{l.last_message_sent.replace(/_/g, ' ')}</span></div>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{l.platform}</td>
                        <td className="px-4 py-3 max-w-xs"><span className="text-xs line-clamp-2" style={{ color: '#94a3b8' }}>{l.what_they_build}</span></td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>{l.stage || '—'}</td>
                        <td className="px-4 py-3 text-xs font-bold" style={{ color: '#06b6d4' }}>{l.mrr_potential || '—'}</td>
                        <td className="px-4 py-3"><LeadBadge status={l.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => openMsgModal(l)}
                              className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
                              style={{ background: '#1e1b4b', color: '#a78bfa', border: '1px solid #3730a3' }}>
                              Generate
                            </button>
                            <button onClick={() => handleMarkSent(l, 'cold_outreach')}
                              className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
                              style={{ background: '#1e2d45', color: '#94a3b8', border: '1px solid #1e2d45' }}>
                              Mark Sent
                            </button>
                            <button onClick={() => openEditModal(l)}
                              className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
                              style={{ background: '#1e2d45', color: '#94a3b8', border: '1px solid #1e2d45' }}>
                              Edit
                            </button>
                            <button onClick={() => handleDeleteLead(l)}
                              className="px-2 py-1 rounded text-xs cursor-pointer"
                              style={{ background: 'transparent', color: '#f87171', border: '1px solid #7f1d1d' }}>
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Services Pipeline ── */}
      {tab === 'services' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: '#f1f5f9' }}>Services Pipeline</h2>
            <button onClick={() => { setJobForm({ company_name: '', scope: '', quoted_price: '', status: 'quoted', hours_spent: '', notes: '' }); setJobModal('new') }}
              className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', border: 'none' }}>
              + New Job
            </button>
          </div>

          {cs && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Pipeline Value',      value: `$${cs.pipeline_value}` },
                { label: 'Completed Revenue',   value: `$${cs.completed_revenue}` },
                { label: 'Total Jobs',          value: cs.total_jobs },
                { label: 'In Progress',         value: cs.in_progress },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                  <div className="text-xs mb-1" style={{ color: '#475569' }}>{s.label}</div>
                  <div className="text-xl font-black" style={{ color: '#06b6d4' }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {jobs.length === 0 ? (
            <p className="text-sm py-12 text-center" style={{ color: '#475569' }}>No jobs yet.</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d45' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#0f1a2e', borderBottom: '1px solid #1e2d45' }}>
                    {['Company', 'Scope', 'Price', 'Status', 'Hours', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#475569' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j, i) => (
                    <tr key={j.id} style={{ borderBottom: '1px solid #1e2d45', background: i % 2 === 0 ? '#070b16' : '#080d18' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#f1f5f9' }}>{j.company_name}</td>
                      <td className="px-4 py-3 text-xs max-w-xs" style={{ color: '#94a3b8' }}>{j.scope}</td>
                      <td className="px-4 py-3 text-sm font-bold" style={{ color: '#06b6d4' }}>${j.quoted_price}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                          style={{ background: j.status === 'paid' ? '#052e16' : j.status === 'in_progress' ? '#1e3a5f' : '#1e2d45', color: j.status === 'paid' ? '#4ade80' : j.status === 'in_progress' ? '#60a5fa' : '#94a3b8' }}>
                          {j.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>{j.hours_spent}h</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => { setJobForm({ ...j, quoted_price: String(j.quoted_price), hours_spent: String(j.hours_spent) }); setJobModal(j) }}
                            className="px-2.5 py-1 rounded text-xs cursor-pointer"
                            style={{ background: '#1e2d45', color: '#94a3b8', border: '1px solid #1e2d45' }}>Edit</button>
                          <button onClick={() => handleDeleteJob(j)}
                            className="px-2 py-1 rounded text-xs cursor-pointer"
                            style={{ background: 'transparent', color: '#f87171', border: '1px solid #7f1d1d' }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Analytics ── */}
      {tab === 'analytics' && ca && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#94a3b8' }}>API Lead Funnel</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Total Leads',    value: ca.total },
                { label: 'Contacted',      value: ca.contacted },
                { label: 'Responded',      value: `${ca.responded} (${ca.response_rate}%)` },
                { label: 'Trialing',       value: `${ca.trialing} (${ca.trial_rate}%)` },
                { label: 'Paying',         value: `${ca.paying} (${ca.pay_rate}%)` },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                  <div className="text-xs mb-1" style={{ color: '#475569' }}>{s.label}</div>
                  <div className="text-xl font-black" style={{ color: '#06b6d4' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="rounded-xl p-4" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                <div className="text-xs mb-1" style={{ color: '#475569' }}>MRR from API</div>
                <div className="text-2xl font-black" style={{ color: '#4ade80' }}>${ca.mrr}</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                <div className="text-xs mb-1" style={{ color: '#475569' }}>Avg MRR / Customer</div>
                <div className="text-2xl font-black" style={{ color: '#4ade80' }}>${ca.avg_mrr}</div>
              </div>
            </div>
          </div>
          {cs && (
            <div>
              <h2 className="text-sm font-semibold mb-4" style={{ color: '#94a3b8' }}>Services</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Pipeline Value',     value: `$${cs.pipeline_value}` },
                  { label: 'Completed Revenue',  value: `$${cs.completed_revenue}` },
                  { label: 'Total Jobs',         value: cs.total_jobs },
                  { label: 'In Progress',        value: cs.in_progress },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-4" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                    <div className="text-xs mb-1" style={{ color: '#475569' }}>{s.label}</div>
                    <div className="text-xl font-black" style={{ color: '#06b6d4' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Message modal ── */}
      {msgModal && (
        <Modal onClose={() => setMsgModal(null)}>
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold" style={{ color: '#f1f5f9' }}>{msgModal.company_name}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{msgModal.what_they_build?.slice(0, 80)}</p>
              </div>
              <button onClick={() => setMsgModal(null)} style={{ color: '#475569', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            {msgLoading && <p className="text-sm text-center py-6" style={{ color: '#475569' }}>Generating…</p>}
            {messages?.error && <p className="text-sm" style={{ color: '#f87171' }}>{messages.error}</p>}
            {messages && !messages.error && !msgLoading && (
              <>
                <div className="flex flex-wrap gap-1 p-1 rounded-lg w-fit" style={{ background: '#111827', border: '1px solid #1e2d45' }}>
                  {[
                    { id: 'cold_outreach',        label: 'Cold Outreach' },
                    { id: 'follow_up',            label: 'Follow-Up' },
                    { id: 'implementation_offer', label: '🔧 Implementation' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setMsgTab(t.id)}
                      className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-all"
                      style={{ background: msgTab === t.id ? '#1e3a5f' : 'transparent', color: msgTab === t.id ? '#e2e8f0' : '#64748b' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {msgTab === 'cold_outreach' && messages.subject && (
                  <div>
                    <div className="text-xs font-medium mb-1" style={{ color: '#475569' }}>Subject</div>
                    <div className="flex items-center gap-2">
                      <input type="text" value={msgEdits.subject ?? messages.subject}
                        onChange={e => setMsgEdits(p => ({ ...p, subject: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
                      <CopyButton text={msgEdits.subject ?? messages.subject} />
                    </div>
                  </div>
                )}
                <textarea rows={10} value={msgEdits[msgTab] || ''}
                  onChange={e => setMsgEdits(p => ({ ...p, [msgTab]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-y"
                  style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0', lineHeight: '1.6' }} />
                <div className="flex items-center gap-2">
                  <CopyButton text={msgEdits[msgTab] || ''} />
                  {msgModal.contact_email && (
                    <button onClick={() => handleSendEmail(msgModal, msgEdits[msgTab] || '')}
                      disabled={sendingEmail === msgModal.id}
                      className="px-3 py-1 rounded text-xs font-medium cursor-pointer disabled:opacity-50"
                      style={{ background: '#052e16', color: '#34d399', border: '1px solid #065f46' }}>
                      {sendingEmail === msgModal.id ? 'Sending…' : 'Send via Email'}
                    </button>
                  )}
                </div>
                <div className="mt-1">
                  <button onClick={() => { handleMarkSent(msgModal, msgTab); setMsgModal(null) }}
                    className="px-3 py-1 rounded text-xs font-medium cursor-pointer"
                    style={{ background: '#1e2d45', color: '#94a3b8', border: '1px solid #1e2d45' }}>
                    Mark "{msgTab.replace(/_/g, ' ')}" as Sent
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Edit lead modal ── */}
      {editModal && (
        <Modal onClose={() => setEditModal(null)}>
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: '#f1f5f9' }}>Edit Lead</h3>
              <button onClick={() => setEditModal(null)} style={{ color: '#475569', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            {[
              { key: 'company_name',  label: 'Company / Project', type: 'text' },
              { key: 'contact_name',  label: 'Contact Name',      type: 'text' },
              { key: 'contact_email', label: 'Email',             type: 'email' },
              { key: 'profile_url',   label: 'Profile URL',       type: 'text' },
              { key: 'github_url',    label: 'GitHub URL',        type: 'text' },
              { key: 'tech_stack',    label: 'Tech Stack',        type: 'text' },
              { key: 'mrr_potential', label: 'MRR Potential',     type: 'text' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-xs mb-1" style={{ color: '#64748b' }}>{label}</label>
                <input type={type} value={editForm[key] || ''}
                  onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
              </div>
            ))}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>What they build</label>
              <textarea rows={3} value={editForm.what_they_build || ''}
                onChange={e => setEditForm(p => ({ ...p, what_they_build: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Status</label>
              <select value={editForm.status || 'new'} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }}>
                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Notes</label>
              <textarea rows={3} value={editForm.notes || ''}
                onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', border: 'none' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditModal(null)}
                className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                style={{ background: '#1e2d45', color: '#64748b', border: 'none' }}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Service job modal ── */}
      {jobModal !== null && (
        <Modal onClose={() => setJobModal(null)}>
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: '#f1f5f9' }}>{jobModal === 'new' ? 'New Job' : 'Edit Job'}</h3>
              <button onClick={() => setJobModal(null)} style={{ color: '#475569', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            {[
              { key: 'company_name', label: 'Company', type: 'text' },
              { key: 'quoted_price', label: 'Quoted Price ($)', type: 'number' },
              { key: 'hours_spent',  label: 'Hours Spent', type: 'number' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-xs mb-1" style={{ color: '#64748b' }}>{label}</label>
                <input type={type} value={jobForm[key] || ''}
                  onChange={e => setJobForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
              </div>
            ))}
            <div>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Scope</label>
              <textarea rows={3} value={jobForm.scope || ''}
                onChange={e => setJobForm(p => ({ ...p, scope: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Status</label>
              <select value={jobForm.status || 'quoted'} onChange={e => setJobForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }}>
                {JOB_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#64748b' }}>Notes</label>
              <textarea rows={2} value={jobForm.notes || ''}
                onChange={e => setJobForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#e2e8f0' }} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveJob} disabled={savingJob}
                className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', border: 'none' }}>
                {savingJob ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setJobModal(null)}
                className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                style={{ background: '#1e2d45', color: '#64748b', border: 'none' }}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
