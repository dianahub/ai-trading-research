import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'

const PAGE_TITLE = 'Congressional Stock Trades — Real-Time STOCK Act Disclosures | Starsignal.io'
const PAGE_DESC  = 'Track the latest stock and asset trades filed by U.S. senators and representatives under the STOCK Act. Filter by Senate or House, search by politician or ticker, and get AI analysis of congressional trading patterns.'
const CANONICAL  = 'https://www.starsignal.io/congress'

const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Congressional Stock Trade Disclosures',
  description: 'Real-time stock and asset trade disclosures filed by U.S. Congress members under the STOCK Act, sourced from efdsearch.senate.gov and disclosures-clerk.house.gov.',
  url: CANONICAL,
  creator: { '@type': 'Organization', name: 'Starsignal.io', url: 'https://www.starsignal.io' },
  isAccessibleForFree: true,
  keywords: ['STOCK Act', 'congressional stock trades', 'senator stock trades', 'house representative trades', 'congress investing', 'politician stock disclosure'],
})

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const LIMIT = 50

function fmt_date(str) {
  if (!str) return '—'
  try {
    return new Date(str.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return str }
}

function TradeCard({ trade }) {
  const isBuy  = trade.trade_type === 'buy'
  const color  = isBuy ? '#10b981' : '#ef4444'
  const bg     = isBuy ? '#052e16' : '#1f0a0a'
  const border = isBuy ? '#065f46' : '#7f1d1d'

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg"
      style={{ background: '#0a0e1a', border: '1px solid #1e2d45' }}>

      {/* Left: member + meta */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-base"
          style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
          {trade.chamber === 'House' ? '🏛' : '⚖️'}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: '#e2e8f0' }}>
            {trade.member || '—'}
          </div>
          <div className="text-xs" style={{ color: '#64748b' }}>
            {trade.chamber} · Tx {fmt_date(trade.tx_date)}
            {trade.disclosed && (
              <span style={{ color: '#475569' }}> · Filed {fmt_date(trade.disclosed)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: ticker + badge + amount + link */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {trade.ticker && (
          <Link
            to={`/?ticker=${encodeURIComponent(trade.ticker)}`}
            className="font-mono text-sm font-bold hover:underline"
            style={{ color: '#38bdf8' }}
            title={`Analyze ${trade.ticker}`}
          >
            {trade.ticker}
          </Link>
        )}
        <span className="px-2.5 py-1 rounded text-xs font-bold tracking-wider"
          style={{ background: bg, color, border: `1px solid ${border}` }}>
          {isBuy ? 'BUY' : 'SELL'}
        </span>
        <span className="text-sm font-mono" style={{ color: '#94a3b8' }}>
          {trade.amount || '—'}
        </span>
        {trade.link && (
          <a href={trade.link} target="_blank" rel="noopener noreferrer"
            className="text-xs hover:underline" style={{ color: '#475569' }}>
            ↗
          </a>
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
      style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span className="font-semibold font-mono" style={{ color: color || '#e2e8f0' }}>{value}</span>
    </div>
  )
}

export default function CongressPage() {
  usePageMeta({ title: PAGE_TITLE, description: PAGE_DESC, canonical: CANONICAL })

  // Inject JSON-LD on mount
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id   = 'congress-jsonld'
    script.text = JSON_LD
    document.head.appendChild(script)
    return () => document.getElementById('congress-jsonld')?.remove()
  }, [])

  const [trades, setTrades]   = useState([])
  const [total, setTotal]     = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]     = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [meta, setMeta]       = useState(null)
  const [chamber, setChamber] = useState('')   // '' | 'Senate' | 'House'
  const [days, setDays]       = useState(30)   // 30 | 60 | 90 | 365 | null
  const [search, setSearch]   = useState('')

  const fetchPage = useCallback(async (currentOffset, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    const params = new URLSearchParams({ limit: LIMIT, offset: currentOffset })
    if (chamber) params.set('chamber', chamber)
    if (days) params.set('days', String(days))

    try {
      const r = await fetch(`${API}/congress/latest?${params}`)
      if (!r.ok) throw new Error(r.status)
      const d = await r.json()
      if (d.unavailable) { setUnavailable(true); return }
      if (append) setTrades(prev => [...prev, ...(d.trades || [])])
      else setTrades(d.trades || [])
      setTotal(d.total ?? 0)
      setHasMore(d.has_more ?? false)
      setOffset(currentOffset + LIMIT)
      setMeta({
        last_updated: d.last_updated,
        data_lag_minutes: d.data_lag_minutes,
        cache_loading: d.cache_loading,
      })
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [chamber, days])

  useEffect(() => {
    setOffset(0)
    setTrades([])
    fetchPage(0, false)
  }, [chamber, days])

  const filtered = search.trim()
    ? trades.filter(t =>
        t.member?.toLowerCase().includes(search.toLowerCase()) ||
        t.ticker?.toLowerCase().includes(search.toLowerCase())
      )
    : trades

  const buys  = filtered.filter(t => t.trade_type === 'buy').length
  const sells = filtered.filter(t => t.trade_type === 'sell').length
  const buyPct = filtered.length ? Math.round(buys / filtered.length * 100) : 0

  return (
    <div style={{ background: '#070b16', minHeight: '100vh', color: '#e2e8f0' }}>
      {/* Header */}
      <header style={{ background: '#0a0e1a', borderBottom: '1px solid #38bdf8' }}
        className="sticky top-0 z-50 px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <span className="text-sm font-bold tracking-widest text-white">Starsignal.io</span>
          </Link>
          <Link to="/" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>
            ← Research dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page title */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, #1e3a5f, #1e1b4b)', border: '1px solid #2d5a8e' }}>
              🏛
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f1f5f9' }}>
              Congressional Stock Trades
            </h1>
          </div>
          <p className="text-sm leading-relaxed max-w-3xl" style={{ color: '#94a3b8' }}>
            Real-time stock and asset trade disclosures filed by U.S. senators and
            representatives. Under the{' '}
            <strong style={{ color: '#cbd5e1' }}>STOCK Act</strong>, members of Congress must
            report trades within 45 days of execution. Data sourced from{' '}
            <a href="https://efdsearch.senate.gov" target="_blank" rel="noopener noreferrer"
              className="hover:underline" style={{ color: '#38bdf8' }}>efdsearch.senate.gov</a>{' '}
            and{' '}
            <a href="https://disclosures-clerk.house.gov" target="_blank" rel="noopener noreferrer"
              className="hover:underline" style={{ color: '#38bdf8' }}>disclosures-clerk.house.gov</a>.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5 items-center">
          {/* Chamber filter */}
          <div className="flex items-center gap-1">
            {[['', 'All'], ['Senate', 'Senate'], ['House', 'House']].map(([val, label]) => (
              <button key={val} onClick={() => setChamber(val)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: chamber === val ? '#0e4a6e' : '#111827',
                  color:      chamber === val ? '#38bdf8' : '#64748b',
                  border:     chamber === val ? '1px solid #38bdf8' : '1px solid #1e2d45',
                }}>
                {label === 'Senate' ? '⚖️ ' : label === 'House' ? '🏛 ' : ''}{label}
              </button>
            ))}
          </div>

          {/* Days filter */}
          <div className="flex items-center gap-1">
            {[[30, '30d'], [60, '60d'], [90, '90d'], [365, '1 yr'], [null, 'All']].map(([val, label]) => (
              <button key={label} onClick={() => setDays(val)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: days === val ? '#0e4a6e' : '#111827',
                  color:      days === val ? '#38bdf8' : '#64748b',
                  border:     days === val ? '1px solid #38bdf8' : '1px solid #1e2d45',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Filter by member or ticker…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{
              background: '#111827',
              border: '1px solid #1e2d45',
              color: '#e2e8f0',
            }}
          />
        </div>

        {/* Stats bar */}
        {!loading && !error && !unavailable && filtered.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <StatPill label="showing" value={filtered.length.toLocaleString()} />
            <StatPill label="total" value={total.toLocaleString()} color="#94a3b8" />
            <StatPill label="buys"  value={`${buys} (${buyPct}%)`} color="#10b981" />
            <StatPill label="sells" value={`${sells} (${100 - buyPct}%)`} color="#ef4444" />
            {meta?.last_updated && (
              <StatPill
                label="updated"
                value={`${meta.data_lag_minutes ?? '?'}m ago`}
                color="#64748b"
              />
            )}
          </div>
        )}

        {/* States */}
        {unavailable && (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: '#64748b' }}>
              Congressional trade data is not configured on this server.
            </p>
          </div>
        )}

        {error && !unavailable && (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: '#ef4444' }}>
              Failed to load trades. Please try again.
            </p>
            <button onClick={() => fetchPage(0)}
              className="mt-3 px-4 py-2 rounded-lg text-xs cursor-pointer hover:brightness-125"
              style={{ background: '#111827', color: '#94a3b8', border: '1px solid #1e2d45' }}>
              Retry
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg animate-pulse"
                style={{ background: '#0d1422', border: '1px solid #1e2d45' }} />
            ))}
          </div>
        )}

        {/* Trade list */}
        {!loading && !error && !unavailable && (
          <>
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm" style={{ color: '#64748b' }}>
                  No trades found for the current filters.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((trade, i) => (
                  <TradeCard key={i} trade={trade} />
                ))}
              </div>
            )}

            {/* Load more — only show when not client-side filtered */}
            {!search && hasMore && (
              <button
                onClick={() => fetchPage(offset, true)}
                disabled={loadingMore}
                className="w-full mt-4 py-3 rounded-lg text-sm font-semibold tracking-wide transition-all cursor-pointer hover:brightness-125"
                style={{ background: '#111827', color: '#94a3b8', border: '1px solid #1e2d45' }}>
                {loadingMore ? 'Loading…' : `Load more ↓`}
              </button>
            )}

            <p className="text-xs text-center pt-6" style={{ color: '#334155' }}>
              For informational purposes only — not a trading signal.
              Click any ticker to open an AI research report.
            </p>
          </>
        )}

        {/* FAQ — keyword-rich content for search engines */}
        <section className="mt-16 pt-10 max-w-3xl" style={{ borderTop: '1px solid #1e2d45' }}>
          <h2 className="text-lg font-bold mb-6" style={{ color: '#e2e8f0' }}>
            About Congressional Stock Trade Disclosures
          </h2>
          <div className="space-y-6">
            {[
              {
                q: 'What is the STOCK Act?',
                a: 'The Stop Trading on Congressional Knowledge (STOCK) Act, signed into law in 2012, prohibits members of Congress and federal employees from trading stocks based on non-public information obtained through their official duties. It also requires members of Congress, their spouses, and dependent children to publicly disclose any stock, bond, or commodity trade over $1,000 within 45 days of the transaction.',
              },
              {
                q: 'How often is this data updated?',
                a: 'The data is refreshed every few hours directly from the Senate Electronic Financial Disclosures (efdsearch.senate.gov) and the House of Representatives financial disclosures portal. Because Congress members have up to 45 days to file, newer trades may not yet appear.',
              },
              {
                q: 'Can I see AI analysis of congressional trades for a specific stock?',
                a: 'Yes. Search any ticker on the Starsignal.io dashboard, then open the Congressional Trades panel and click the AI Analysis tab. Claude reads the disclosed trade data and summarizes whether congressional sentiment is bullish, bearish, or mixed — plus any notable patterns like clusters of buying or a single member driving most of the volume.',
              },
              {
                q: 'What does the trade amount range mean?',
                a: 'The STOCK Act requires disclosure of a trade\'s approximate value in one of several ranges: $1,001–$15,000 · $15,001–$50,000 · $50,001–$100,000 · $100,001–$250,000 · $250,001–$500,000 · $500,001–$1,000,000 · over $1,000,000. Exact amounts are not required.',
              },
              {
                q: 'Is this data a trading signal?',
                a: 'No. This data is provided for informational and educational purposes only. Congressional disclosures are public record, but a disclosed trade is not investment advice. Always do your own research before making any financial decision.',
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <h3 className="text-sm font-semibold mb-1" style={{ color: '#cbd5e1' }}>{q}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
