import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const ASTRO_URL = import.meta.env.VITE_ASTRO_URL ?? 'https://astro-api-production.up.railway.app'

function adminHeaders(email, password) {
  return {
    'Content-Type': 'application/json',
    'x-admin-email':    email,
    'x-admin-password': password,
  }
}

function Badge({ tier }) {
  const map = {
    free:     { label: 'Free',     bg: '#1e2d45', color: '#64748b' },
    verified: { label: 'Verified', bg: '#0e4d6b', color: '#7dd3fc' },
    featured: { label: 'Featured', bg: '#1e1b4b', color: '#a5b4fc' },
  }
  const t = map[tier] ?? map.free
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: t.bg, color: t.color }}>
      {t.label}
    </span>
  )
}

function StatusDot({ status }) {
  const c = { pending: '#fbbf24', approved: '#22d3ee', rejected: '#f87171' }
  return (
    <span className="flex items-center gap-1.5 text-xs capitalize"
      style={{ color: c[status] ?? '#475569' }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c[status] ?? '#475569' }} />
      {status}
    </span>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
      <div className="text-xs mb-1" style={{ color: '#475569' }}>{label}</div>
      <div className="text-2xl font-black" style={{ color: '#06b6d4' }}>{value}</div>
    </div>
  )
}

export default function AdminPartners() {
  const [creds, setCreds] = useState(() => ({
    email:    sessionStorage.getItem('admin_email')    ?? '',
    password: sessionStorage.getItem('admin_password') ?? '',
  }))
  const [authed, setAuthed] = useState(false)
  const [loginErr, setLoginErr] = useState('')

  const [partners, setPartners] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [editTier, setEditTier] = useState('')
  const [editFeatured, setEditFeatured] = useState(false)

  async function login(e) {
    e.preventDefault()
    setLoginErr('')
    // Test credentials against the API
    const res = await fetch(`${ASTRO_URL}/api/v1/admin/partners`, {
      headers: adminHeaders(creds.email, creds.password),
    })
    if (res.status === 401 || res.status === 403) {
      setLoginErr('Invalid credentials.')
      return
    }
    sessionStorage.setItem('admin_email',    creds.email)
    sessionStorage.setItem('admin_password', creds.password)
    setAuthed(true)
  }

  function logout() {
    sessionStorage.removeItem('admin_email')
    sessionStorage.removeItem('admin_password')
    setAuthed(false)
    setPartners([])
    setStats(null)
  }

  async function loadData() {
    setLoading(true)
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${ASTRO_URL}/api/v1/admin/partners?status=${statusFilter}`, { headers: adminHeaders(creds.email, creds.password) }),
        fetch(`${ASTRO_URL}/api/v1/admin/partners/stats`,                  { headers: adminHeaders(creds.email, creds.password) }),
      ])
      if (pRes.ok) setPartners(await pRes.json())
      if (sRes.ok) setStats(await sRes.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authed) loadData()
  }, [authed, statusFilter])

  async function openDetail(partner) {
    setSelected(partner)
    setDetailLoading(true)
    setDetail(null)
    setActionMsg('')
    setShowRejectInput(false)
    setRejectReason('')
    setEditTier(partner.tier)
    setEditFeatured(partner.manuallyFeatured ?? false)
    const res = await fetch(`${ASTRO_URL}/api/v1/admin/partners/${partner.id}`, {
      headers: adminHeaders(creds.email, creds.password),
    })
    if (res.ok) setDetail(await res.json())
    setDetailLoading(false)
  }

  async function approve() {
    setActionLoading(true)
    setActionMsg('')
    const res = await fetch(`${ASTRO_URL}/api/v1/admin/partners/${selected.id}/approve`, {
      method: 'POST',
      headers: adminHeaders(creds.email, creds.password),
    })
    const data = await res.json()
    setActionMsg(res.ok ? '✓ Approved — magic link sent.' : (data.error ?? 'Error'))
    if (res.ok) { setSelected(null); loadData() }
    setActionLoading(false)
  }

  async function reject() {
    if (!rejectReason.trim()) { setActionMsg('Please enter a rejection reason.'); return }
    setActionLoading(true)
    setActionMsg('')
    const res = await fetch(`${ASTRO_URL}/api/v1/admin/partners/${selected.id}/reject`, {
      method: 'POST',
      headers: adminHeaders(creds.email, creds.password),
      body: JSON.stringify({ reason: rejectReason }),
    })
    const data = await res.json()
    setActionMsg(res.ok ? '✓ Rejected — email sent.' : (data.error ?? 'Error'))
    if (res.ok) { setSelected(null); loadData() }
    setActionLoading(false)
  }

  async function updatePartner() {
    setActionLoading(true)
    setActionMsg('')
    const res = await fetch(`${ASTRO_URL}/api/v1/admin/partners/${selected.id}`, {
      method: 'PATCH',
      headers: adminHeaders(creds.email, creds.password),
      body: JSON.stringify({ tier: editTier, manuallyFeatured: editFeatured }),
    })
    const data = await res.json()
    setActionMsg(res.ok ? '✓ Saved.' : (data.error ?? 'Error'))
    if (res.ok) loadData()
    setActionLoading(false)
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b16' }}>
        <div className="w-full max-w-sm mx-4">
          <div className="rounded-xl p-8" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
            <h1 className="text-xl font-bold mb-1 text-center" style={{ color: '#f1f5f9' }}>Partner Admin</h1>
            <p className="text-xs text-center mb-6" style={{ color: '#475569' }}>Admin access only</p>
            {loginErr && (
              <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: '#2d1515', border: '1px solid #f87171', color: '#fca5a5' }}>
                {loginErr}
              </div>
            )}
            <form onSubmit={login} className="flex flex-col gap-3">
              <input type="email" placeholder="Admin email" value={creds.email}
                onChange={e => setCreds(c => ({ ...c, email: e.target.value }))}
                className="px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#070b16', border: '1px solid #1e2d45', color: '#e2e8f0' }} />
              <input type="password" placeholder="Password" value={creds.password}
                onChange={e => setCreds(c => ({ ...c, password: e.target.value }))}
                className="px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: '#070b16', border: '1px solid #1e2d45', color: '#e2e8f0' }} />
              <button type="submit"
                className="py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#070b16', color: '#e2e8f0' }}>
      {/* Nav */}
      <header className="sticky top-0 z-50 px-6 py-4"
        style={{ background: 'rgba(7,11,22,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d45' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>AI</div>
              <span className="text-sm font-bold tracking-widest text-white">Starsignal</span>
            </Link>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1e2d45', color: '#475569' }}>Admin</span>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: '#475569' }}>
            <Link to="/admin/outreach" style={{ color: '#475569', textDecoration: 'none' }}>Outreach</Link>
            <button onClick={logout} className="px-3 py-1.5 rounded-lg"
              style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', cursor: 'pointer' }}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Partner Management</h1>
          <button onClick={loadData} className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
            ↻ Refresh
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <StatCard label="MRR" value={`$${stats.mrr ?? 0}`} />
            <StatCard label="Total Partners" value={stats.total ?? 0} />
            <StatCard label="Pending Review" value={stats.pending ?? 0} />
            <StatCard label="Verified" value={stats.verified ?? 0} />
            <StatCard label="Featured" value={stats.featured ?? 0} />
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6">
          {['pending', 'approved', 'rejected', 'all'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize"
              style={{
                background: statusFilter === s ? 'linear-gradient(135deg,#06b6d4,#3b82f6)' : '#0f1a2e',
                border: `1px solid ${statusFilter === s ? '#06b6d4' : '#1e2d45'}`,
                color: statusFilter === s ? '#fff' : '#94a3b8',
                cursor: 'pointer',
              }}>
              {s}
            </button>
          ))}
        </div>

        {/* Partners table */}
        {loading ? (
          <div className="text-sm text-center py-12" style={{ color: '#475569' }}>Loading…</div>
        ) : partners.length === 0 ? (
          <div className="text-sm text-center py-12" style={{ color: '#475569' }}>No partners in this status.</div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d45' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0f1a2e', borderBottom: '1px solid #1e2d45' }}>
                  {['Name', 'Email', 'Tier', 'Status', 'RSS', 'Applied', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#475569' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partners.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1e2d45', background: i % 2 === 0 ? '#070b16' : '#080d18' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: '#e2e8f0' }}>{p.name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{p.email}</td>
                    <td className="px-4 py-3"><Badge tier={p.tier} /></td>
                    <td className="px-4 py-3"><StatusDot status={p.status} /></td>
                    <td className="px-4 py-3 text-xs max-w-[160px] truncate">
                      {p.rssUrl
                        ? <a href={p.rssUrl} target="_blank" rel="noreferrer" style={{ color: '#06b6d4' }}>{p.rssUrl.replace(/^https?:\/\//, '')}</a>
                        : <span style={{ color: '#334155' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(p)}
                        className="text-xs px-3 py-1 rounded-lg"
                        style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ background: 'rgba(7,11,22,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="h-full w-full max-w-lg overflow-y-auto"
            style={{ background: '#0a0e1a', borderLeft: '1px solid #1e2d45' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid #1e2d45' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold" style={{ color: '#f1f5f9' }}>{selected.name}</h2>
                <button onClick={() => setSelected(null)} className="text-xl" style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge tier={selected.tier} />
                <StatusDot status={selected.status} />
              </div>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {actionMsg && (
                <div className="px-4 py-2 rounded-lg text-xs"
                  style={{
                    background: actionMsg.startsWith('✓') ? '#0f2a1a' : '#2d1515',
                    border: `1px solid ${actionMsg.startsWith('✓') ? '#166534' : '#f87171'}`,
                    color:   actionMsg.startsWith('✓') ? '#86efac' : '#fca5a5',
                  }}>
                  {actionMsg}
                </div>
              )}

              {detailLoading && <div className="text-sm text-center py-8" style={{ color: '#475569' }}>Loading details…</div>}

              {detail && !detailLoading && (
                <>
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'Email', val: detail.email },
                      { label: 'Website', val: detail.website, link: true },
                      { label: 'Insights Extracted', val: detail.insightsExtracted ?? 0 },
                      { label: 'Impressions', val: detail.totalImpressions ?? 0 },
                      { label: 'Publishing Since', val: detail.publishingYears?.replace(/_/g, ' ') },
                      { label: 'Frequency', val: detail.publishFrequency },
                    ].map(({ label, val, link }) => val ? (
                      <div key={label}>
                        <div style={{ color: '#475569' }}>{label}</div>
                        {link ? (
                          <a href={val} target="_blank" rel="noreferrer" style={{ color: '#06b6d4' }}>{val}</a>
                        ) : (
                          <div style={{ color: '#e2e8f0' }}>{val}</div>
                        )}
                      </div>
                    ) : null)}
                  </div>

                  {detail.bio && (
                    <div>
                      <div className="text-xs mb-1" style={{ color: '#475569' }}>Bio</div>
                      <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{detail.bio}</p>
                    </div>
                  )}

                  {detail.contentTypes?.length > 0 && (
                    <div>
                      <div className="text-xs mb-2" style={{ color: '#475569' }}>Content Types</div>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.contentTypes.map(ct => (
                          <span key={ct} className="px-2 py-0.5 rounded-full text-xs"
                            style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8' }}>
                            {ct.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RSS feed preview */}
                  {detail.feedPreview?.length > 0 && (
                    <div>
                      <div className="text-xs mb-2" style={{ color: '#475569' }}>Feed Preview (last 5)</div>
                      <div className="flex flex-col gap-2">
                        {detail.feedPreview.map((item, i) => (
                          <div key={i} className="rounded-lg px-3 py-2" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                            <a href={item.link} target="_blank" rel="noreferrer" className="text-xs font-medium" style={{ color: '#06b6d4', textDecoration: 'none' }}>
                              {item.title}
                            </a>
                            <div className="text-xs mt-0.5" style={{ color: '#475569' }}>
                              {item.pubDate ? new Date(item.pubDate).toLocaleDateString() : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Edit tier / featured */}
                  <div className="rounded-xl px-5 py-4" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                    <div className="text-xs font-semibold mb-3" style={{ color: '#94a3b8' }}>Settings</div>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: '#cbd5e1' }}>Tier</span>
                        <select value={editTier} onChange={e => setEditTier(e.target.value)}
                          className="px-2 py-1 rounded text-xs outline-none"
                          style={{ background: '#070b16', border: '1px solid #1e2d45', color: '#e2e8f0', cursor: 'pointer' }}>
                          <option value="free">Free</option>
                          <option value="verified">Verified</option>
                          <option value="featured">Featured</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: '#cbd5e1' }}>Manually Featured</span>
                        <button onClick={() => setEditFeatured(f => !f)}
                          className="w-8 h-4 rounded-full transition-all relative"
                          style={{ background: editFeatured ? '#06b6d4' : '#1e2d45', border: 'none', cursor: 'pointer' }}>
                          <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                            style={{ left: editFeatured ? '17px' : '2px' }} />
                        </button>
                      </div>
                      <button onClick={updatePartner} disabled={actionLoading}
                        className="py-2 rounded-lg text-xs font-semibold"
                        style={{ background: actionLoading ? '#1e2d45' : '#0f2a1a', border: '1px solid #166534', color: '#86efac', cursor: 'pointer' }}>
                        {actionLoading ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </div>

                  {/* Approve / Reject */}
                  {detail.status === 'pending' && (
                    <div className="flex flex-col gap-3">
                      <button onClick={approve} disabled={actionLoading}
                        className="py-3 rounded-xl font-semibold text-sm"
                        style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', border: 'none', cursor: actionLoading ? 'not-allowed' : 'pointer' }}>
                        {actionLoading ? 'Working…' : '✓ Approve & Send Magic Link'}
                      </button>
                      {!showRejectInput ? (
                        <button onClick={() => setShowRejectInput(true)} disabled={actionLoading}
                          className="py-2.5 rounded-xl text-sm font-medium"
                          style={{ background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', cursor: 'pointer' }}>
                          Reject
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (sent to applicant)…"
                            rows={3}
                            className="px-3 py-2 rounded-lg text-xs outline-none resize-none"
                            style={{ background: '#070b16', border: '1px solid #7f1d1d', color: '#e2e8f0' }}
                          />
                          <button onClick={reject} disabled={actionLoading}
                            className="py-2 rounded-lg text-xs font-semibold"
                            style={{ background: '#7f1d1d', color: '#fff', border: 'none', cursor: 'pointer' }}>
                            {actionLoading ? 'Working…' : 'Send Rejection'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
