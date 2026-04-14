// CongressPanel.jsx
// Displays recent congressional stock trades (House + Senate) from public disclosures.
import { useState } from 'react'

function fmt_date(str) {
  if (!str) return '—'
  try {
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
          style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#64748b' }}
        >
          {trade.chamber === 'House' ? '🏛' : '⚖️'}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: '#e2e8f0' }}>
            {trade.member}
          </div>
          <div className="text-xs" style={{ color: '#475569' }}>
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
            style={{ color: '#475569' }}
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

  const { total = 0, trades = [] } = congressData ?? {}

  const unavailable = !congressData

  const PREVIEW = 5
  const visible  = showAll ? trades : trades.slice(0, PREVIEW)
  const hasMore  = trades.length > PREVIEW

  const buys  = trades.filter(t => t.trade_type === 'buy').length
  const sells = trades.filter(t => t.trade_type === 'sell').length

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#0b0f1e', border: '1px solid #1e2d45' }}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-4"
        style={{ borderBottom: '1px solid #1e2d45' }}>
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
              <span className="ml-2 text-xs" style={{ color: '#475569' }}>
                {total} disclosure{total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {total > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span style={{ color: '#10b981' }}>▲ {buys} buy{buys !== 1 ? 's' : ''}</span>
            <span style={{ color: '#ef4444' }}>▼ {sells} sell{sells !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5 space-y-3">
        {unavailable ? (
          <p className="text-sm text-center py-6" style={{ color: '#475569' }}>
            Congressional data unavailable — the backend may need a restart to load this feature.
          </p>
        ) : total === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: '#475569' }}>
            No congressional disclosures found for <span className="font-mono text-white">{ticker}</span>.
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
                  color: '#64748b',
                  border: '1px solid #1e2d45',
                }}
              >
                {showAll ? 'Show less' : `Show all ${trades.length} disclosures ↓`}
              </button>
            )}

            <p className="text-xs pt-1" style={{ color: '#334155', borderTop: '1px solid #1e2d45', paddingTop: 10 }}>
              Data sourced from public House &amp; Senate financial disclosures (STOCK Act). Trades are disclosed up to 45 days after execution. Not a trading signal — for informational purposes only.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
