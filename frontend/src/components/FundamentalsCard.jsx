import { useState, useEffect } from 'react'
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'

function fmt(v, prefix = '$') {
  if (v == null) return 'N/A'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6)  return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`
  return `${sign}${prefix}${abs.toLocaleString()}`
}

function pct(v) {
  if (v == null) return 'N/A'
  return `${v > 0 ? '+' : ''}${v}%`
}

function MetricCell({ label, value, highlight }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#0a0e1a', border: '1px solid #1e2d45' }}>
      <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: '#64748b' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: highlight || '#e2e8f0' }}>{value}</div>
    </div>
  )
}

function HealthBadge({ score }) {
  if (score == null) return null
  const color = score >= 7 ? '#22c55e' : score >= 4 ? '#f59e0b' : '#ef4444'
  const label = score >= 7 ? 'Strong' : score >= 4 ? 'Moderate' : 'Weak'
  const desc  = score >= 7
    ? 'Healthy across margins, debt, and cash flow'
    : score >= 4
    ? 'Mixed — strong in some areas, weak in others'
    : 'Concerns across margins, leverage, or cash flow'
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold self-start"
        style={{ background: `${color}22`, border: `1px solid ${color}44`, color }}>
        {label} · {score}/10
      </span>
      <span className="text-xs" style={{ color: '#64748b' }}>{desc}</span>
    </div>
  )
}

function EarningsRow({ entry }) {
  const surprise = entry.surprise_pct
  const Icon = surprise == null ? Minus : surprise > 0 ? TrendingUp : TrendingDown
  const color = surprise == null ? '#64748b' : surprise > 0 ? '#22c55e' : '#ef4444'
  return (
    <div className="flex items-center justify-between text-xs py-1.5"
      style={{ borderBottom: '1px solid #1e2d4533' }}>
      <span style={{ color: '#64748b' }}>{entry.period || '—'}</span>
      <span style={{ color: '#e2e8f0' }}>EPS {entry.eps_actual ?? '—'}</span>
      <span style={{ color: '#94a3b8' }}>Est {entry.eps_estimate ?? '—'}</span>
      <span className="flex items-center gap-1" style={{ color }}>
        <Icon size={11} />
        {surprise != null ? `${surprise > 0 ? '+' : ''}${surprise}%` : '—'}
      </span>
    </div>
  )
}

export default function FundamentalsCard({ fundamentals }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleOpen = (e) => { if (e.detail === '#fundamentals') setOpen(true) }
    window.addEventListener('open-section', handleOpen)
    return () => window.removeEventListener('open-section', handleOpen)
  }, [])

  if (!fundamentals) return null

  const fd = fundamentals
  const revGrowth = fd.revenue_growth_yoy_pct
  const revColor = revGrowth == null ? '#94a3b8' : revGrowth > 0 ? '#22c55e' : '#ef4444'
  const marginColor = (m) => m == null ? '#94a3b8' : m > 15 ? '#22c55e' : m > 5 ? '#f59e0b' : '#ef4444'
  const deColor = fd.debt_to_equity == null ? '#94a3b8' : fd.debt_to_equity < 0.5 ? '#22c55e' : fd.debt_to_equity < 1.5 ? '#f59e0b' : '#ef4444'
  const crColor = fd.current_ratio == null ? '#94a3b8' : fd.current_ratio > 2 ? '#22c55e' : fd.current_ratio > 1 ? '#f59e0b' : '#ef4444'

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#111827', border: '1px solid #38bdf8' }}>
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: open ? '1px solid #38bdf844' : 'none' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#38bdf822' }}>
            <span style={{ color: '#38bdf8', fontSize: 14 }}>📊</span>
          </div>
          <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: '#e2e8f0' }}>
            Fundamentals
          </h3>
          <HealthBadge score={fd.health_score} />
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold flex-shrink-0"
          style={{
            background: open ? '#1e3a5f' : '#0f1a2e',
            border: '1px solid #1e3a5f',
            cursor: 'pointer',
            color: '#e2e8f0',
            fontSize: 13,
            letterSpacing: '0.05em',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1e3a5f'}
          onMouseLeave={e => { if (!open) e.currentTarget.style.background = '#0f1a2e' }}
        >
          <span>{open ? 'HIDE' : 'SHOW'}</span>
          <ChevronDown size={15} style={{ color: '#06b6d4', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>

      {open && (
        <div className="p-5 space-y-5">
          {/* Top-line numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCell label="Revenue (TTM)" value={fmt(fd.revenue)} />
            <MetricCell label="Net Income (TTM)" value={fmt(fd.net_income)}
              highlight={fd.net_income > 0 ? '#22c55e' : fd.net_income < 0 ? '#ef4444' : undefined} />
            <MetricCell label="Free Cash Flow" value={fmt(fd.free_cash_flow)}
              highlight={fd.free_cash_flow > 0 ? '#22c55e' : fd.free_cash_flow < 0 ? '#ef4444' : undefined} />
            <MetricCell label="Revenue Growth" value={pct(revGrowth)} highlight={revColor} />
          </div>

          {/* Margins + leverage */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCell label="Gross Margin" value={fd.gross_margin_pct != null ? `${fd.gross_margin_pct}%` : 'N/A'}
              highlight={marginColor(fd.gross_margin_pct)} />
            <MetricCell label="Operating Margin" value={fd.operating_margin_pct != null ? `${fd.operating_margin_pct}%` : 'N/A'}
              highlight={marginColor(fd.operating_margin_pct)} />
            <MetricCell label="Net Margin" value={fd.net_margin_pct != null ? `${fd.net_margin_pct}%` : 'N/A'}
              highlight={marginColor(fd.net_margin_pct)} />
            <MetricCell label="Debt / Equity" value={fd.debt_to_equity ?? 'N/A'} highlight={deColor} />
            <MetricCell label="Current Ratio" value={fd.current_ratio ?? 'N/A'} highlight={crColor} />
            <MetricCell label="Cash on Hand" value={fmt(fd.cash)} />
          </div>

          {/* Earnings history */}
          {fd.earnings_history?.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: '#0a0e1a', border: '1px solid #1e2d45' }}>
              <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#94a3b8' }}>
                Earnings History — EPS vs Estimate
              </div>
              <div>
                {fd.earnings_history.map((e, i) => <EarningsRow key={i} entry={e} />)}
              </div>
              <p className="text-xs mt-2" style={{ color: '#475569' }}>
                Positive surprise % = beat estimates · Negative = missed
              </p>
            </div>
          )}

          {/* Revenue trend */}
          {fd.revenue_trend?.length > 1 && (
            <div className="rounded-xl p-4" style={{ background: '#0a0e1a', border: '1px solid #1e2d45' }}>
              <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#94a3b8' }}>
                Annual Revenue Trend
              </div>
              <div className="space-y-2">
                {[...fd.revenue_trend].reverse().map((s, i) => {
                  const maxRev = Math.max(...fd.revenue_trend.map(x => x.revenue || 0))
                  const barW = maxRev > 0 ? Math.round((s.revenue || 0) / maxRev * 100) : 0
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="w-24 shrink-0" style={{ color: '#64748b' }}>
                        {s.period?.slice(0, 4) || '—'}
                      </span>
                      <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#1e2d45', height: 6 }}>
                        <div className="h-full rounded-full" style={{ width: `${barW}%`, background: '#06b6d4' }} />
                      </div>
                      <span className="w-20 text-right" style={{ color: '#e2e8f0' }}>{fmt(s.revenue)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <p className="text-xs" style={{ color: '#475569' }}>
            Source: Financial Datasets · TTM = trailing twelve months · Health score (0–10): 2 pts each for gross margin &gt;40%, operating margin &gt;15%, debt/equity &lt;0.5, current ratio &gt;2, and positive free cash flow
          </p>
        </div>
      )}
    </div>
  )
}
