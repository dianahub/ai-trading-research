// CongressPanel.jsx
// Displays recent congressional stock trades (House + Senate) from public disclosures.
import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

function fmt_date(str) {
  if (!str) return '—'
  try {
    // Backend sends MM/DD/YYYY — convert to ISO before parsing
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
      {/* Left: name + chamber */}
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

      {/* Right: trade type + amount */}
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

export default function CongressPanel({ congressData, ticker }) {
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleHash = () => { if (window.location.hash === '#congress') setOpen(true) }
    const handleOpen = (e) => { if (e.detail === '#congress') setOpen(true) }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    window.addEventListener('open-section', handleOpen)
    return () => {
      window.removeEventListener('hashchange', handleHash)
      window.removeEventListener('open-section', handleOpen)
    }
  }, [])

  const { total = 0, trades = [], cache_loading = false } = congressData ?? {}

  const unavailable = !congressData

  const PREVIEW = 5
  const visible  = showAll ? trades : trades.slice(0, PREVIEW)
  const hasMore  = trades.length > PREVIEW

  const buys  = trades.filter(t => t.trade_type === 'buy').length
  const sells = trades.filter(t => t.trade_type === 'sell').length

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
            <span className="text-sm font-semibold tracking-wide" style={{ color: '#e2e8f0' }}>
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
      {open && <div className="p-5 space-y-3">
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
            No congressional disclosures found for <span className="font-mono text-white">{ticker}</span> in the last 6 months.
          </p>
        ) : (
          <>
            {visible.map((trade, i) => (
              <TradeRow key={i} trade={trade} />
            ))}

            {hasMore && (
              <button
                onClick={() => setShowAll(s => !s)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all cursor-pointer hover:brightness-125"
                style={{
                  background: '#111827',
                  color: '#94a3b8',
                  border: '1px solid #1e2d45',
                }}
              >
                {showAll ? 'Show less' : `Show all ${trades.length} disclosures ↓`}
              </button>
            )}

            <p className="text-xs pt-1" style={{ color: '#94a3b8', borderTop: '1px solid #1e2d45', paddingTop: 10 }}>
              Senate data sourced live from efdsearch.senate.gov (STOCK Act). Trades disclosed up to 45 days after execution. Not a trading signal — for informational purposes only.
            </p>
          </>
        )}
      </div>}
    </div>
  )
}
