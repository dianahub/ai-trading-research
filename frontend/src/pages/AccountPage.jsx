import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { logout, tierLabel, tierColor } from '../lib/auth'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
      <div className="text-2xl font-black mb-1" style={{ color: color || '#06b6d4' }}>{value}</div>
      <div className="text-xs" style={{ color: '#475569' }}>{label}</div>
    </div>
  )
}

function UpgradeBanner({ currentTier }) {
  if (['premium', 'platform'].includes(currentTier)) return null
  const next = currentTier === 'pro' ? 'premium' : 'pro'
  const price = next === 'pro' ? '$29' : '$79'
  const perks = next === 'pro'
    ? ['Full insights feed', 'Real-time price data', 'All signals']
    : ['Composite score', 'API access', 'Alerts']
  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: 'linear-gradient(135deg,#0f1a2e,#0a1428)', border: '1px solid #1e3a5f' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#06b6d4' }}>
            Upgrade to {tierLabel(next)} — {price}/month
          </p>
          <p className="text-xs" style={{ color: '#64748b' }}>
            Unlocks: {perks.join(' · ')}
          </p>
        </div>
        <button onClick={() => upgradeToTier(next)}
          className="px-4 py-2 rounded-lg text-xs font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff' }}>
          Upgrade
        </button>
      </div>
    </div>
  )
}

async function upgradeToTier(tier) {
  const r = await fetch(`${API}/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tier }),
  })
  const d = await r.json()
  if (d.url) window.location.href = d.url
  else alert('Stripe not configured yet — contact contact@starsignal.io')
}

async function openPortal() {
  const r = await fetch(`${API}/stripe/portal`, { method: 'POST', credentials: 'include' })
  const d = await r.json()
  if (d.url) window.location.href = d.url
  else alert('No billing account found')
}

export default function AccountPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const showSuccess = params.get('success') === '1'
  const showBetaExpired = params.get('beta_expired') === '1'

  useEffect(() => {
    fetch(`${API}/auth/account`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setAccount(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  function copyReferral() {
    navigator.clipboard.writeText(account.referral_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}>
      <p style={{ color: '#475569' }}>Loading…</p>
    </div>
  )

  if (!account) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}>
      <div className="text-center">
        <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>Please sign in to view your account.</p>
        <Link to="/login" className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', textDecoration: 'none' }}>
          Sign In
        </Link>
      </div>
    </div>
  )

  if (account.beta_expired) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#060a14' }}>
      <div className="w-full max-w-md rounded-2xl p-8 text-center" style={{ background: '#0b1120', border: '1px solid #1e3a5f' }}>
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Your beta has ended</h2>
        <p className="text-sm mb-6" style={{ color: '#94a3b8', lineHeight: 1.6 }}>
          Your 30-day beta has expired. Add a card to continue at the founding member rate —
          <strong style={{ color: '#e2e8f0' }}> $19/month, locked in forever</strong>.
        </p>
        <button onClick={() => upgradeToTier('pro')}
          className="w-full py-3 rounded-xl font-bold text-sm mb-3"
          style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff' }}>
          Continue at $19/month →
        </button>
        <button onClick={handleLogout}
          className="w-full py-2.5 rounded-xl text-sm"
          style={{ background: 'transparent', border: '1px solid #1e2d45', color: '#64748b', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    </div>
  )

  const tierBg = { free: '#1e2d45', beta: '#0f2a3d', pro: '#0e2840', premium: '#1e1040', platform: '#2a1e00' }

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      {/* Nav */}
      <header className="sticky top-0 z-50 px-6 py-4"
        style={{ background: 'rgba(6,10,20,.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d45' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span className="text-white font-bold tracking-widest text-sm">✦ Star Signal</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm" style={{ color: '#64748b', textDecoration: 'none' }}>Dashboard</Link>
            <button onClick={handleLogout} className="text-sm" style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">

        {showSuccess && (
          <div className="rounded-xl px-5 py-3 mb-6 text-sm"
            style={{ background: '#052e16', border: '1px solid #166534', color: '#4ade80' }}>
            ✓ Subscription activated! Welcome to {tierLabel(account.tier)}.
          </div>
        )}
        {showBetaExpired && (
          <div className="rounded-xl px-5 py-3 mb-6 text-sm"
            style={{ background: '#1c1200', border: '1px solid #7c3a00', color: '#fbbf24' }}>
            Your beta has expired. Upgrade to keep access.
          </div>
        )}

        {/* Tier card */}
        <div className="rounded-2xl p-6 mb-6"
          style={{ background: tierBg[account.tier] || '#0f1a2e', border: `1px solid ${tierColor(account.tier)}40` }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Current plan</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: tierColor(account.tier) + '22', color: tierColor(account.tier) }}>
                  {tierLabel(account.tier)}
                </span>
              </div>
              <p className="text-2xl font-black" style={{ color: '#f1f5f9' }}>
                {account.first_name} {account.last_name}
              </p>
              <p className="text-sm" style={{ color: '#64748b' }}>{account.email}</p>
            </div>
            {account.tier === 'beta' && account.beta_days_left !== null && (
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-black" style={{ color: account.beta_days_left < 5 ? '#f97316' : '#06b6d4' }}>
                  {account.beta_days_left}
                </div>
                <div className="text-xs" style={{ color: '#475569' }}>days left</div>
              </div>
            )}
          </div>

          {account.tier === 'beta' && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1e2d45' }}>
              <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                After beta: lock in founding member pricing at <strong style={{ color: '#e2e8f0' }}>$19/month forever</strong>
              </p>
              <button onClick={() => upgradeToTier('pro')}
                className="px-5 py-2.5 rounded-lg text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff' }}>
                Activate Founding Member — $19/mo
              </button>
            </div>
          )}
        </div>

        {!['premium', 'platform'].includes(account.tier) && <UpgradeBanner currentTier={account.tier} />}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Plan" value={tierLabel(account.tier)} color={tierColor(account.tier)} />
          {account.tier === 'beta' && <StatCard label="Beta days left" value={account.beta_days_left ?? '—'} color="#06b6d4" />}
          <StatCard label="Referrals sent" value={account.referrals_total ?? 0} />
          <StatCard label="Converted" value={account.referrals_converted ?? 0} color="#4ade80" />
        </div>

        {/* Referral */}
        <div className="rounded-xl p-5 mb-6" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#f1f5f9' }}>Your referral link</h3>
          <p className="text-xs mb-3" style={{ color: '#64748b' }}>
            Share this link. When a friend converts to any paid plan, you get 1 month free.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2.5 rounded-lg text-sm font-mono truncate"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8' }}>
              {account.referral_link}
            </div>
            <button onClick={copyReferral}
              className="px-4 py-2.5 rounded-lg text-xs font-semibold flex-shrink-0"
              style={{ background: copied ? '#052e16' : '#0f1a2e', border: '1px solid #1e2d45',
                color: copied ? '#4ade80' : '#64748b' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Billing */}
        {['pro', 'premium', 'platform'].includes(account.tier) && (
          <div className="rounded-xl p-5 mb-6" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#f1f5f9' }}>Billing</h3>
            <button onClick={openPortal}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8' }}>
              Manage billing →
            </button>
          </div>
        )}

        {/* Platform upgrade CTA */}
        <div className="rounded-xl p-5" style={{ background: '#1a1200', border: '1px solid #3d2f00' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold mb-1" style={{ color: '#d4a847' }}>Platform tier — $299/month</p>
              <p className="text-xs" style={{ color: '#64748b' }}>
                White-label data feeds, bulk API access, dedicated support, co-marketing.
                Manual activation only.
              </p>
            </div>
            <a href="mailto:contact@starsignal.io?subject=Platform Tier Inquiry"
              className="px-4 py-2 rounded-lg text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#d4a847,#b8860b)', color: '#0a0a0a', textDecoration: 'none' }}>
              Contact us
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
