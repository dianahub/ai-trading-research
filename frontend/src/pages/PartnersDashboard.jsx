import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

const ASTRO_URL = import.meta.env.VITE_ASTRO_URL ?? 'https://astro-api-production.up.railway.app'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl p-5" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
      <div className="text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>{label}</div>
      <div className="text-2xl font-black mb-0.5" style={{ color: '#06b6d4' }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: '#94a3b8' }}>{sub}</div>}
    </div>
  )
}

function Badge({ tier }) {
  const map = {
    free:     { label: 'Free',     bg: '#1e2d45',                                color: '#94a3b8' },
    verified: { label: 'Verified', bg: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff' },
    featured: { label: 'Featured', bg: 'linear-gradient(135deg,#1e1b4b,#312e81)', color: '#a5b4fc' },
  }
  const t = map[tier] ?? map.free
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: t.bg, color: t.color, border: tier === 'free' ? '1px solid #334155' : 'none' }}>
      {t.label}
    </span>
  )
}

function LoginPrompt({ onLogin }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function sendLink(e) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      const res = await fetch(`${ASTRO_URL}/api/v1/partners/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Error sending link'); setLoading(false); return }
      setSent(true)
    } catch {
      setErr('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">✉️</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Check your email</h2>
        <p className="text-sm" style={{ color: '#94a3b8' }}>
          We sent a login link to <strong style={{ color: '#e2e8f0' }}>{email}</strong>.<br />
          Click the link to access your dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto py-16">
      <div className="rounded-xl p-8" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
        <h2 className="text-xl font-bold mb-2 text-center" style={{ color: '#f1f5f9' }}>Partner Login</h2>
        <p className="text-sm text-center mb-6" style={{ color: '#94a3b8' }}>
          Enter your partner email and we'll send a magic link.
        </p>
        {err && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: '#2d1515', border: '1px solid #f87171', color: '#fca5a5' }}>
            {err}
          </div>
        )}
        <form onSubmit={sendLink} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: '#070b16', border: '1px solid #1e2d45', color: '#e2e8f0' }}
          />
          <button type="submit" disabled={loading}
            className="py-2.5 rounded-lg text-sm font-semibold"
            style={{
              background: loading ? '#1e2d45' : 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              color: loading ? '#94a3b8' : '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none',
            }}>
            {loading ? 'Sending…' : 'Send Login Link'}
          </button>
        </form>
      </div>
      <p className="text-xs text-center mt-4" style={{ color: '#94a3b8' }}>
        Not a partner yet?{' '}
        <Link to="/partners/apply" style={{ color: '#06b6d4', textDecoration: 'none' }}>Apply to join →</Link>
      </p>
    </div>
  )
}

export default function PartnersDashboard() {
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState(() => localStorage.getItem('partner_token') ?? '')
  const [partner, setPartner] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [recentInsights, setRecentInsights] = useState([])
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [billingLoading, setBillingLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [commissions, setCommissions] = useState(null)
  const [commissionsLoading, setCommissionsLoading] = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
  const [copied, setCopied] = useState(null)

  // Handle magic link token from URL
  useEffect(() => {
    const t = searchParams.get('token')
    if (t) verifyToken(t)
    const tab = searchParams.get('tab')
    if (tab) setActiveTab(tab)
  }, [])

  // Auto-load if we have a stored token
  useEffect(() => {
    if (token && !partner) loadDashboard(token)
  }, [token])

  async function verifyToken(t) {
    setLoading(true)
    setAuthError('')
    try {
      const res = await fetch(`${ASTRO_URL}/api/v1/partners/auth/verify?token=${t}`)
      const data = await res.json()
      if (!res.ok) { setAuthError(data.error ?? 'Invalid or expired link'); setLoading(false); return }
      localStorage.setItem('partner_token', t)
      setToken(t)
      // loadDashboard will fire from useEffect
    } catch {
      setAuthError('Network error.')
      setLoading(false)
    }
  }

  async function loadDashboard(t) {
    setLoading(true)
    try {
      const res = await fetch(`${ASTRO_URL}/api/v1/partners/dashboard`, {
        headers: { 'x-partner-token': t },
      })
      if (res.status === 401) {
        localStorage.removeItem('partner_token')
        setToken('')
        setAuthError('Session expired. Please log in again.')
        setLoading(false)
        return
      }
      const data = await res.json()
      setPartner(data.partner)
      setAnalytics(data.analytics)
      setRecentInsights(data.recentInsights ?? [])
      setEditForm({
        bio:        data.partner.bio ?? '',
        photoUrl:   data.partner.photoUrl ?? '',
        twitterUrl: data.partner.twitterUrl ?? '',
        substackUrl: data.partner.substackUrl ?? '',
        youtubeUrl: data.partner.youtubeUrl ?? '',
      })
    } catch {
      setAuthError('Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('partner_token')
    setToken('')
    setPartner(null)
    setAnalytics(null)
  }

  async function saveProfile() {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch(`${ASTRO_URL}/api/v1/partners/dashboard/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-partner-token': token },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { setSaveMsg(data.error ?? 'Save failed'); setSaving(false); return }
      setPartner(p => ({ ...p, ...editForm }))
      setEditMode(false)
      setSaveMsg('Profile updated.')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg('Network error.')
    } finally {
      setSaving(false)
    }
  }

  async function openBillingPortal() {
    setBillingLoading(true)
    try {
      const res = await fetch(`${ASTRO_URL}/api/v1/partners/dashboard/billing-portal`, {
        method: 'POST',
        headers: { 'x-partner-token': token },
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      // silently fail
    } finally {
      setBillingLoading(false)
    }
  }

  async function loadCommissions() {
    setCommissionsLoading(true)
    try {
      const res = await fetch(`${API}/partners/commissions`, { credentials: 'include' })
      if (res.ok) setCommissions(await res.json())
    } catch { /* ignore */ } finally {
      setCommissionsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'commissions' && !commissions) loadCommissions()
  }, [activeTab])

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  async function handleStripeConnect() {
    setConnectLoading(true)
    try {
      const res = await fetch(`${API}/partners/stripe-connect`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { /* ignore */ } finally {
      setConnectLoading(false)
    }
  }

  const statusColor = {
    pending:  '#fbbf24',
    approved: '#22d3ee',
    rejected: '#f87171',
  }

  return (
    <div className="min-h-screen" style={{ background: '#070b16', color: '#e2e8f0' }}>
      {/* Nav */}
      <header className="sticky top-0 z-50 px-6 py-4"
        style={{ background: 'rgba(7,11,22,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d45' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div>
              <div className="text-sm font-bold tracking-widest text-white">Starsignal.io</div>
              <div className="text-xs" style={{ color: '#94a3b8' }}>Partner Dashboard</div>
            </div>
          </Link>
          {partner && (
            <button onClick={logout} className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8', cursor: 'pointer' }}>
              Log out
            </button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {!partner && !loading && (
          <LoginPrompt />
        )}

        {loading && (
          <div className="text-center py-24 text-sm" style={{ color: '#94a3b8' }}>Loading…</div>
        )}

        {authError && !loading && !partner && (
          <div className="max-w-sm mx-auto mt-8">
            <div className="rounded-xl p-6 text-center" style={{ background: '#2d1515', border: '1px solid #f87171' }}>
              <p className="text-sm mb-4" style={{ color: '#fca5a5' }}>{authError}</p>
              <button onClick={() => setAuthError('')} className="text-xs px-4 py-2 rounded-lg"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                Try Again
              </button>
            </div>
          </div>
        )}

        {partner && !loading && (
          <div className="flex flex-col gap-8">
            {/* Tab nav */}
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
              {[['overview', 'Overview'], ['commissions', 'Commissions']].map(([id, label]) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: activeTab === id ? 'linear-gradient(135deg,#06b6d4,#3b82f6)' : 'transparent',
                    color: activeTab === id ? '#fff' : '#94a3b8',
                    border: 'none', cursor: 'pointer',
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── Commissions tab ── */}
            {activeTab === 'commissions' && (
              <div className="flex flex-col gap-6">
                {commissionsLoading && (
                  <div className="text-sm text-center py-12" style={{ color: '#94a3b8' }}>Loading…</div>
                )}
                {!commissionsLoading && commissions && (() => {
                  const { partner: p, summary } = commissions
                  const slug = p.slug
                  const refLink = p.referral_link
                  return (
                    <>
                      {/* Summary cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Earned this month" value={`$${summary.this_month_earned.toFixed(2)}`} />
                        <StatCard label="Total earned" value={`$${summary.total_earned.toFixed(2)}`} />
                        <StatCard label="Pending payout" value={`$${summary.pending_payout.toFixed(2)}`} />
                        <StatCard label="Signups referred" value={summary.signup_count} />
                      </div>

                      {/* Referral link */}
                      <div className="rounded-xl p-5" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                        <div className="text-xs font-semibold mb-3" style={{ color: '#94a3b8' }}>Your referral link</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 px-3 py-2 rounded-lg text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap"
                            style={{ background: '#060a14', border: '1px solid #1e2d45', color: '#06b6d4' }}>
                            {refLink}
                          </div>
                          <button onClick={() => copy(refLink, 'link')}
                            className="px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                            style={{ background: copied === 'link' ? '#14532d' : '#1e2d45', color: copied === 'link' ? '#86efac' : '#94a3b8', border: 'none', cursor: 'pointer' }}>
                            {copied === 'link' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-xs mt-2" style={{ color: '#64748b' }}>
                          When someone signs up through this link within 30 days you earn 20% of their subscription every month.
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: '#64748b' }}>
                          <span>{p.referral_click_count || 0} link clicks</span>
                          <span>·</span>
                          <span>{summary.signup_count} signups</span>
                          <span>·</span>
                          <span>Next payout: {summary.next_payout_date}</span>
                        </div>
                      </div>

                      {/* Discount code */}
                      {p.discount_code && (
                        <div className="rounded-xl p-5" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                          <div className="text-xs font-semibold mb-3" style={{ color: '#94a3b8' }}>Your discount code</div>
                          <div className="flex items-center gap-2">
                            <div className="px-4 py-2 rounded-lg text-base font-bold font-mono tracking-widest"
                              style={{ background: '#060a14', border: '1px solid #1e2d45', color: '#f1f5f9' }}>
                              {p.discount_code}
                            </div>
                            <button onClick={() => copy(p.discount_code, 'code')}
                              className="px-3 py-2 rounded-lg text-xs font-semibold"
                              style={{ background: copied === 'code' ? '#14532d' : '#1e2d45', color: copied === 'code' ? '#86efac' : '#94a3b8', border: 'none', cursor: 'pointer' }}>
                              {copied === 'code' ? 'Copied!' : 'Copy'}
                            </button>
                            {!p.discount_code_active && (
                              <span className="px-2 py-1 rounded text-xs" style={{ background: '#2d1515', color: '#f87171' }}>Inactive</span>
                            )}
                          </div>
                          <p className="text-xs mt-2" style={{ color: '#64748b' }}>
                            Share this with your audience — anyone who enters it at signup gets <strong style={{ color: '#e2e8f0' }}>45 days free</strong> instead of 30, and you get commission credit automatically.
                          </p>
                          <div className="mt-2 text-xs" style={{ color: '#64748b' }}>
                            Used {p.discount_code_uses || 0} times
                          </div>
                        </div>
                      )}

                      {/* Payout account */}
                      <div className="rounded-xl p-5" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                        <div className="text-xs font-semibold mb-3" style={{ color: '#94a3b8' }}>Payout account</div>
                        {p.stripe_connect_account_id ? (
                          <div className="flex items-center gap-3">
                            <span className="text-sm" style={{ color: '#22c55e' }}>✓ Bank account connected</span>
                            <button onClick={handleStripeConnect} disabled={connectLoading}
                              className="px-3 py-1.5 rounded-lg text-xs"
                              style={{ background: '#1e2d45', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>
                              Manage
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>
                              Connect your bank account to receive automatic payouts on the 1st of each month. Minimum payout is $20.
                            </p>
                            <button onClick={handleStripeConnect} disabled={connectLoading}
                              className="px-4 py-2 rounded-lg text-xs font-semibold"
                              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                              {connectLoading ? 'Loading…' : 'Connect Bank Account'}
                            </button>
                            <p className="text-xs mt-2" style={{ color: '#64748b' }}>
                              No bank account? We'll flag your payout for manual transfer and reach out.
                            </p>
                          </>
                        )}
                      </div>

                      {/* Payout history */}
                      {commissions.payout_history.length > 0 && (
                        <div className="rounded-xl p-5" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                          <div className="text-xs font-semibold mb-3" style={{ color: '#94a3b8' }}>Payout history</div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ color: '#64748b' }}>
                                <th className="text-left pb-2">Month</th>
                                <th className="text-right pb-2">Amount</th>
                                <th className="text-right pb-2">Method</th>
                                <th className="text-right pb-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {commissions.payout_history.map((p, i) => (
                                <tr key={i} style={{ borderTop: '1px solid #1e2d45' }}>
                                  <td className="py-2" style={{ color: '#e2e8f0' }}>{p.month}</td>
                                  <td className="py-2 text-right" style={{ color: '#e2e8f0' }}>${p.amount.toFixed(2)}</td>
                                  <td className="py-2 text-right" style={{ color: '#94a3b8' }}>{p.payout_method || 'pending'}</td>
                                  <td className="py-2 text-right">
                                    <span className="px-2 py-0.5 rounded-full" style={{
                                      background: p.status === 'paid' ? '#14532d' : p.status === 'ready' ? '#1e3a5f' : '#1e2d45',
                                      color: p.status === 'paid' ? '#86efac' : p.status === 'ready' ? '#7dd3fc' : '#94a3b8',
                                    }}>{p.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )
                })()}
                {!commissionsLoading && !commissions && (
                  <div className="text-sm text-center py-12" style={{ color: '#94a3b8' }}>
                    Commission data not available. Make sure your partner email matches your login.
                  </div>
                )}
              </div>
            )}

            {/* ── Overview tab ── */}
            {activeTab === 'overview' && (
            <div className="flex flex-col gap-8">
            {/* Header row */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {partner.photoUrl ? (
                  <img src={partner.photoUrl} alt={partner.name}
                    className="w-14 h-14 rounded-full object-cover"
                    style={{ border: '2px solid #1e2d45' }} />
                ) : (
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ background: '#1e2d45', color: '#94a3b8' }}>
                    {partner.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold" style={{ color: '#f1f5f9' }}>{partner.name}</span>
                    <Badge tier={partner.tier} />
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{partner.email}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ background: statusColor[partner.status] ?? '#94a3b8' }} />
                    <span className="text-xs capitalize" style={{ color: statusColor[partner.status] ?? '#94a3b8' }}>
                      {partner.status}
                    </span>
                  </div>
                </div>
              </div>
              {partner.tier !== 'free' && (
                <button onClick={openBillingPortal} disabled={billingLoading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
                  {billingLoading ? 'Loading…' : 'Manage Billing'}
                </button>
              )}
            </div>

            {/* Pending notice */}
            {partner.status === 'pending' && (
              <div className="rounded-xl px-5 py-4 text-sm" style={{ background: '#1a1500', border: '1px solid #854d0e', color: '#fbbf24' }}>
                ⏳ Your application is under review. We'll email you at <strong>{partner.email}</strong> within 48 hours.
              </div>
            )}

            {/* Analytics */}
            {partner.status === 'approved' && (
              <div>
                <h2 className="text-sm font-semibold mb-4" style={{ color: '#94a3b8' }}>Analytics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Impressions This Month" value={analytics?.impressionsThisMonth ?? 0} />
                  <StatCard label="Total Impressions" value={analytics?.totalImpressions ?? 0} />
                  <StatCard label="Insights Extracted" value={partner.insightsExtracted ?? 0} />
                  <StatCard
                    label="Feed Status"
                    value={partner.lastFetchError ? 'Error' : 'OK'}
                    sub={partner.lastFetchedAt ? `Last: ${new Date(partner.lastFetchedAt).toLocaleDateString()}` : 'Not yet fetched'}
                  />
                </div>
                {partner.lastFetchError && (
                  <div className="mt-3 px-4 py-2 rounded-lg text-xs" style={{ background: '#2d1515', border: '1px solid #f87171', color: '#fca5a5' }}>
                    Feed error: {partner.lastFetchError}
                  </div>
                )}
              </div>
            )}

            {/* Recent insights */}
            {recentInsights.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-4" style={{ color: '#94a3b8' }}>Recent Insights Extracted</h2>
                <div className="flex flex-col gap-3">
                  {recentInsights.slice(0, 5).map((ins, i) => (
                    <div key={i} className="rounded-xl px-5 py-4" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#06b6d4' }}>{ins.topic}</span>
                        <span className="text-xs" style={{ color: '#94a3b8' }}>{ins.published_date}</span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{ins.summary}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#0f2a1a', color: '#22d3ee' }}>{ins.outlook}</span>
                        <span className="text-xs" style={{ color: '#94a3b8' }}>{ins.timeframe}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Profile edit */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: '#94a3b8' }}>Profile</h2>
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8', cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button onClick={saveProfile} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: saving ? '#1e2d45' : 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: saving ? '#94a3b8' : '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {saveMsg && (
                <div className="mb-3 px-4 py-2 rounded-lg text-xs" style={{ background: '#0f2a1a', border: '1px solid #166534', color: '#86efac' }}>
                  {saveMsg}
                </div>
              )}

              <div className="rounded-xl p-6" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                {editMode ? (
                  <div className="flex flex-col gap-4">
                    {[
                      { label: 'Bio', key: 'bio', maxLength: 200 },
                      { label: 'Photo URL', key: 'photoUrl' },
                      { label: 'Twitter / X', key: 'twitterUrl' },
                      { label: 'Substack', key: 'substackUrl' },
                      { label: 'YouTube', key: 'youtubeUrl' },
                    ].map(({ label, key, maxLength }) => (
                      <div key={key} className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium" style={{ color: '#cbd5e1' }}>{label}</label>
                        {key === 'bio' ? (
                          <textarea
                            value={editForm[key] ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                            maxLength={maxLength}
                            rows={3}
                            className="px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                            style={{ background: '#070b16', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                          />
                        ) : (
                          <input
                            type="text"
                            value={editForm[key] ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                            className="px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{ background: '#070b16', border: '1px solid #1e2d45', color: '#e2e8f0' }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {partner.bio && (
                      <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{partner.bio}</p>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-xs pt-2" style={{ borderTop: '1px solid #1e2d45' }}>
                      {partner.website && (
                        <div>
                          <span style={{ color: '#94a3b8' }}>Website </span>
                          <a href={partner.website} target="_blank" rel="noreferrer" style={{ color: '#06b6d4' }}>{partner.website}</a>
                        </div>
                      )}
                      {partner.rssUrl && (
                        <div>
                          <span style={{ color: '#94a3b8' }}>RSS </span>
                          <a href={partner.rssUrl} target="_blank" rel="noreferrer" style={{ color: '#06b6d4' }}>{partner.rssUrl}</a>
                        </div>
                      )}
                      {partner.twitterUrl && (
                        <div>
                          <span style={{ color: '#94a3b8' }}>Twitter </span>
                          <a href={partner.twitterUrl} target="_blank" rel="noreferrer" style={{ color: '#06b6d4' }}>@{partner.twitterUrl.replace(/.*\//, '')}</a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            </div> {/* end overview inner flex */}
            )} {/* end overview tab */}
          </div>
        )}
      </div>

      <footer className="px-6 py-8" style={{ borderTop: '1px solid #1e2d45', background: '#0a0e1a' }}>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs" style={{ color: '#94a3b8' }}>© 2026 Futurotek LLC. All rights reserved.</span>
          <div className="flex items-center gap-4 text-xs" style={{ color: '#94a3b8' }}>
            <Link to="/terms" style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms</Link>
            <Link to="/privacy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy</Link>
            <a href="https://www.linkedin.com/company/113175994/" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
