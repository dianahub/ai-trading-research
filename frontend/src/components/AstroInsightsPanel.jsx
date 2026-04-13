// AstroInsightsPanel.jsx
// Displays financial astrology insights from the Astro API microservice.

const OUTLOOK_CONFIG = {
  bullish:  { color: '#10b981', bg: '#052e16', border: '#065f46', label: 'BULLISH' },
  bearish:  { color: '#ef4444', bg: '#1f0a0a', border: '#7f1d1d', label: 'BEARISH' },
  volatile: { color: '#f59e0b', bg: '#1c1200', border: '#78350f', label: 'VOLATILE' },
  cautious: { color: '#f59e0b', bg: '#1c1200', border: '#78350f', label: 'CAUTIOUS' },
  stable:   { color: '#94a3b8', bg: '#0f1623', border: '#1e2d45', label: 'STABLE'  },
}

function outlookCfg(outlook) {
  return OUTLOOK_CONFIG[outlook?.toLowerCase()] ?? OUTLOOK_CONFIG.stable
}

function ConfidenceBar({ value }) {
  // value 0-1
  const pct = Math.round((value ?? 0) * 100)
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: '#1e2d45' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span className="text-xs font-mono" style={{ color, minWidth: 32 }}>{pct}%</span>
    </div>
  )
}

function SentimentGauge({ score }) {
  // score -1.0 to 1.0
  const clamped = Math.max(-1, Math.min(1, score ?? 0))
  const pct     = Math.round(((clamped + 1) / 2) * 100)   // map -1…1 → 0…100
  const color   = clamped > 0.1 ? '#10b981' : clamped < -0.1 ? '#ef4444' : '#94a3b8'
  const label   = clamped > 0.1 ? 'Bullish' : clamped < -0.1 ? 'Bearish' : 'Neutral'

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs" style={{ color: '#475569' }}>Overall Astro Sentiment</span>
        <span className="text-xs font-semibold" style={{ color }}>{label} ({clamped > 0 ? '+' : ''}{clamped.toFixed(2)})</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#1e2d45' }}>
        {/* Centre marker */}
        <div className="absolute top-0 bottom-0" style={{ left: '50%', width: 1, background: '#334155', zIndex: 1 }} />
        <div
          className="absolute top-0 bottom-0 rounded-full transition-all duration-500"
          style={{
            left:       clamped >= 0 ? '50%' : `${pct}%`,
            width:      `${Math.abs(clamped) * 50}%`,
            background: color,
            opacity:    0.85,
          }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: '#334155' }}>
        <span>−1 Bearish</span>
        <span>Neutral</span>
        <span>Bullish +1</span>
      </div>
    </div>
  )
}

function InsightCard({ insight }) {
  const cfg = outlookCfg(insight.outlook)

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold tracking-wider"
            style={{ background: cfg.border, color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span
            className="px-2 py-0.5 rounded text-xs tracking-wider"
            style={{ background: '#111827', color: '#64748b', border: '1px solid #1e2d45' }}
          >
            {insight.topic?.toUpperCase()}
          </span>
          <span className="text-xs" style={{ color: '#475569' }}>
            {insight.timeframe}
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
        {insight.summary}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <ConfidenceBar value={insight.confidence} />
        <a
          href={insight.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-4 text-xs shrink-0 hover:underline transition-colors"
          style={{ color: '#475569' }}
        >
          {insight.source_name} ↗
        </a>
      </div>
    </div>
  )
}

export default function AstroInsightsPanel({ astroData, visible, onToggle }) {
  if (!astroData) return null

  const { available, sentiment_score, overall_summary, insights = [], total_insights } = astroData

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#0b0f1e', border: '1px solid #1e2d45' }}
    >
      {/* Panel header with toggle */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: visible ? '1px solid #1e2d45' : 'none' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: '1px solid #3730a3' }}
          >
            ♄
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide" style={{ color: '#e2e8f0' }}>
              Astro Insights
            </span>
            {available && total_insights > 0 && (
              <span className="ml-2 text-xs" style={{ color: '#475569' }}>
                {total_insights} signal{total_insights !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {!available && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1e2d45', color: '#475569' }}>
              Service offline
            </span>
          )}
        </div>

        <button
          onClick={onToggle}
          className="text-xs px-3 py-1 rounded transition-colors cursor-pointer"
          style={{
            background: visible ? '#1e2d45' : '#111827',
            color: '#64748b',
            border: '1px solid #1e2d45',
          }}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* Panel body */}
      {visible && (
        <div className="p-5 space-y-5">
          {!available ? (
            <p className="text-sm text-center py-6" style={{ color: '#475569' }}>
              Astro API is currently unreachable. Insights will appear when the service is available.
            </p>
          ) : total_insights === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#475569' }}>
              No insights collected yet. Check back after the next ingestion cycle.
            </p>
          ) : (
            <>
              {/* Sentiment gauge */}
              <SentimentGauge score={sentiment_score} />

              {/* Overall summary */}
              {overall_summary && (
                <div
                  className="rounded-lg p-4"
                  style={{ background: '#0f1623', border: '1px solid #1e2d45' }}
                >
                  <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                    {overall_summary}
                  </p>
                </div>
              )}

              {/* Individual insight cards */}
              <div className="space-y-3">
                {insights.map((insight, i) => (
                  <InsightCard key={insight.id ?? i} insight={insight} />
                ))}
              </div>
            </>
          )}

          {/* Disclaimer */}
          <p className="text-xs pt-2" style={{ color: '#334155', borderTop: '1px solid #1e2d45', paddingTop: 12 }}>
            ♄ Astrological insights are alternative data for informational purposes only and do not constitute investment advice.
          </p>
        </div>
      )}
    </div>
  )
}
