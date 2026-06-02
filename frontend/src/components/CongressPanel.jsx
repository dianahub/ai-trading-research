// CongressPanel.jsx
// Displays recent congressional stock trades (House + Senate) from public disclosures.
import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

function fmt_date(str) {
  if (!str) return '—'
  try {
    const parts = str.split('/')
    if (parts.length === 3) {
      const [m, d, y] = parts
      return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    }
    return new Date(str.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return str }
}

function TradeRow({ trade }) {
  const isBuy   = trade.trade_type === 'buy'
  const color   = isBuy ? '#10b981' : '#ef4444'
  const bg      = isBuy ? '#052e16' : '#1f0a0a'
  const border  = isBuy ? '#065f46' : '#7f1d1d'
  const label   = isBuy ? 'BUY' : 'SELL'

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg"
      style={{ background: '#0a0e1a', border: '1px solid #1e2d45' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
          style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#94a3b8' }}
        >
          {trade.chamber === 'House' ? '🏛' : '⚖️'}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: '#e2e8f0' }}>
            {trade.member}
          </div>
          <div className="text-xs" style={{ color: '#94a3b8' }}>
            {trade.chamber} · {fmt_date(trade.tx_date)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className="px-2.5 py-1 rounded text-xs font-bold tracking-wider"
          style={{ background: bg, color, border: `1px solid ${border}` }}
        >
          {label}
        </span>
        <span className="text-sm font-mono font-semibold" style={{ color: '#94a3b8' }}>
          {trade.amount}
        </span>
        {trade.link && (
          <a
            href={trade.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:underline shrink-0"
            style={{ color: '#94a3b8' }}
          >
            ↗
          </a>
        )}
      </div>
    </div>
  )
}

const SENTIMENT_STYLES = {
  bullish: { color: '#10b981', bg: '#052e16', border: '#065f46', label: 'BULLISH' },
  bearish: { color: '#ef4444', bg: '#1f0a0a', border: '#7f1d1d', label: 'BEARISH' },
  mixed:   { color: '#f59e0b', bg: '#1c1400', border: '#92400e', label: 'MIXED'   },
  neutral: { color: '#94a3b8', bg: '#111827', border: '#1e2d45', label: 'NEUTRAL' },
}

function AISummaryTab({ ticker }) {
  const [state, setState] = useState('idle') // idle | loading | done | error
  const [data, setData]   = useState(null)

  useEffect(() => {
    if (!ticker) return
    setState('loading')
    setData(null)
    fetch(`${BACKEND}/congress/${encodeURIComponent(ticker)}/summary`)
      .then(r => r.json())
      .then(d => {
        if (d.unavailable) { setState('error'); return }
        setData(d)
        setState('done')
      })
      .catch(() => setState('error'))
  }, [ticker])

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-10 text-sm" style={{ color: '#94a3b8' }}>
        <span className="animate-pulse">Generating AI analysis…</span>
      </div>
    )
  }

  if (state === 'error' || !data?.ai_analysis) {
    return (
      <p className="text-sm text-center py-8" style={{ color: '#64748b' }}>
        AI analysis unavailable for <span className="font-mono" style={{ color: '#94a3b8' }}>{ticker}</span>.
      </p>
    )
  }

  const ai = data.ai_analysis
  const s  = ai.stats || {}
  const sentiment = (ai.sentiment || 'neutral').toLowerCase()
  const style = SENTIMENT_STYLES[sentiment] || SENTIMENT_STYLES.neutral
  const buyPct  = s.total_trades ? Math.round(s.buys / s.total_trades * 100) : 0
  const sellPct = 100 - buyPct

  return (
    <div className="space-y-4">
      {/* Sentiment + stats row */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="px-3 py-1 rounded text-xs font-bold tracking-widest"
          style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
        >
          {style.label}
        </span>
        <span className="text-xs" style={{ color: '#10b981' }}>▲ {s.buys ?? '—'} buys ({buyPct}%)</span>
        <span className="text-xs" style={{ color: '#ef4444' }}>▼ {s.sells ?? '—'} sells ({sellPct}%)</span>
        <span className="text-xs" style={{ color: '#94a3b8' }}>{s.unique_members ?? '—'} members</span>
        {s.date_range?.earliest && (
          <span className="text-xs" style={{ color: '#64748b' }}>
            {s.date_range.earliest} → {s.date_range.latest}
          </span>
        )}
      </div>

      {/* Summary */}
      {ai.summary && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>Summary</p>
          <p className="text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>{ai.summary}</p>
        </div>
      )}

      {/* Notable patterns */}
      {ai.notable_patterns && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>Notable patterns</p>
          <p className="text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>{ai.notable_patterns}</p>
        </div>
      )}

      <p className="text-xs pt-2" style={{ color: '#334155', borderTop: '1px solid #1e2d45', paddingTop: 10 }}>
        Based strictly on disclosed filing data — no speculation or outside information.
        {ai.cached && <span style={{ color: '#475569' }}> · Cached today</span>}
      </p>
    </div>
  )
}

export default function CongressPanel({ congressData, ticker }) {
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen]       = useState(false)
  const [tab, setTab]         = useState('trades') // 'trades' | 'ai'

  useEffect(() => {
    const handleHash  = () => { if (window.location.hash === '#congress') setOpen(true) }
    const handleOpen  = (e) => { if (e.detail === '#congress') setOpen(true) }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    window.addEventListener('open-section', handleOpen)
    return () => {
      window.removeEventListener('hashchange', handleHash)
      window.removeEventListener('open-section', handleOpen)
    }
  }, [])

  // Reset tab when ticker changes
  useEffect(() => { setTab('trades'); setShowAll(false) }, [ticker])

  const { total = 0, trades = [], cache_loading = false } = congressData ?? {}
  const unavailable = !congressData
  const PREVIEW = 5
  const visible  = showAll ? trades : trades.slice(0, PREVIEW)
  const hasMore  = trades.length > PREVIEW
  const buys     = trades.filter(t => t.trade_type === 'buy').length
  const sells    = trades.filter(t => t.trade_type === 'sell').length

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#0b0f1e', border: '1px solid #38bdf8' }}
    >
      {/* Header — accordion toggle */}
      <div
        className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer select-none"
        style={{ borderBottom: open ? '1px solid #1e2d45' : 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #1e1b4b)', border: '1px solid #2d5a8e' }}
          >
            🏛
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide uppercase" style={{ color: '#e2e8f0' }}>
              Congressional Trades
            </span>
            {total > 0 && (
              <span className="ml-2 text-xs" style={{ color: '#94a3b8' }}>
                {total} disclosure{total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {total > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span style={{ color: '#10b981' }}>▲ {buys} buy{buys !== 1 ? 's' : ''}</span>
              <span style={{ color: '#ef4444' }}>▼ {sells} sell{sells !== 1 ? 's' : ''}</span>
            </div>
          )}
          <ChevronDown
            size={16}
            style={{
              color: '#94a3b8',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          />
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="p-5">
          {unavailable ? (
            <p className="text-sm text-center py-6" style={{ color: '#94a3b8' }}>
              Congressional data unavailable.
            </p>
          ) : cache_loading && total === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#94a3b8' }}>
              Senate disclosure data is loading in the background — check back in a few minutes.
            </p>
          ) : total === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#94a3b8' }}>
              No congressional disclosures found for <span className="font-mono text-white">{ticker}</span> in the last year.
            </p>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid #1e2d45' }}>
                {[
                  { key: 'trades', label: 'Trades' },
                  { key: 'ai',     label: 'AI Analysis' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={e => { e.stopPropagation(); setTab(key) }}
                    className="px-4 py-2 text-xs font-semibold tracking-wide transition-colors"
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: tab === key ? '2px solid #38bdf8' : '2px solid transparent',
                      color: tab === key ? '#38bdf8' : '#64748b',
                      cursor: 'pointer',
                      marginBottom: '-1px',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Trades tab */}
              {tab === 'trades' && (
                <div className="space-y-3">
                  <p className="text-xs pb-3" style={{ color: '#64748b', borderBottom: '1px solid #1e2d45' }}>
                    Under the STOCK Act, members of Congress must disclose stock trades within 45 days of execution.
                    This panel shows House and Senate disclosures for{' '}
                    <span className="font-mono" style={{ color: '#94a3b8' }}>{ticker}</span> over the past year.
                  </p>

                  {visible.map((trade, i) => (
                    <TradeRow key={i} trade={trade} />
                  ))}

                  {hasMore && (
                    <button
                      onClick={() => setShowAll(s => !s)}
                      className="w-full py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all cursor-pointer hover:brightness-125"
                      style={{ background: '#111827', color: '#94a3b8', border: '1px solid #1e2d45' }}
                    >
                      {showAll ? 'Show less' : `Show all ${trades.length} disclosures ↓`}
                    </button>
                  )}

                  <p className="text-xs pt-1" style={{ color: '#94a3b8', borderTop: '1px solid #1e2d45', paddingTop: 10 }}>
                    Data sourced from efdsearch.senate.gov and disclosures-clerk.house.gov. Not a trading signal — for informational purposes only.
                  </p>
                </div>
              )}

              {/* AI Analysis tab */}
              {tab === 'ai' && <AISummaryTab ticker={ticker} />}
            </>
          )}
        </div>
      )}
    </div>
  )
}
