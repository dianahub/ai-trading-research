// AstroInsightsPanel.jsx
// Displays financial astrology insights from the Astro API microservice.
import { useState } from 'react'

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
  const pct = Math.round((parseFloat(value) || 0) * 100)
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col gap-1 flex-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: '#1e2d45' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.4s ease' }} />
        </div>
        <span className="text-xs font-mono" style={{ color, minWidth: 32 }}>{pct}%</span>
      </div>
      <span className="text-xs" style={{ color: '#475569' }}>Astrologer's confidence in this signal</span>
    </div>
  )
}

function SentimentGauge({ score }) {
  const clamped = Math.max(-1, Math.min(1, parseFloat(score) || 0))
  const pct     = Math.round(((clamped + 1) / 2) * 100)
  const color   = clamped > 0.1 ? '#10b981' : clamped < -0.1 ? '#ef4444' : '#94a3b8'
  const label   = clamped > 0.1 ? 'Bullish' : clamped < -0.1 ? 'Bearish' : 'Neutral'

  return (
    <div className="space-y-2 rounded-lg px-4 py-3" style={{ background: '#0f1a2e', border: '1px solid #1e3a5f' }}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold" style={{ color: '#e2e8f0' }}>Overall Astro Sentiment</span>
        <span className="text-sm font-bold px-2 py-0.5 rounded" style={{ color, background: `${color}22`, border: `1px solid ${color}66` }}>{label} ({clamped > 0 ? '+' : ''}{clamped.toFixed(2)})</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#1e2d45' }}>
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

      <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
        {insight.summary}
      </p>

      <div className="flex items-center justify-between pt-1">
        {insight.confidence != null && !isNaN(insight.confidence) && <ConfidenceBar value={insight.confidence} />}
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

// Shows only the match header/stats — no cards (cards are handled in the main panel)
function DirectMatchHeader({ ticker, topic, insights, breakdown }) {
  const topicInsights = insights.filter(i => i.topic === topic)
  const topicStats    = breakdown?.[topic]
  if (topicInsights.length === 0) return null

  const cfg        = outlookCfg(topicStats?.dominantOutlook)
  const score      = parseFloat(topicStats?.sentimentScore) || 0
  const scoreLabel = score > 0.05 ? 'Bullish' : score < -0.05 ? 'Bearish' : 'Neutral'
  const scoreColor = score > 0.05 ? '#10b981' : score < -0.05 ? '#ef4444' : '#94a3b8'

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2"
      style={{
        background: 'linear-gradient(135deg, #0d1f0d, #0b1a2e)',
        border: `1px solid ${cfg.border}`,
        boxShadow: `0 0 20px ${cfg.border}55`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="px-2.5 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          ♄ Direct Astro Coverage
        </span>
        <span className="text-xs font-mono font-semibold" style={{ color: '#94a3b8' }}>
          {ticker} → {topic.toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span style={{ color: '#475569' }}>{topicInsights.length} signal{topicInsights.length !== 1 ? 's' : ''}</span>
        <span className="font-semibold" style={{ color: scoreColor }}>
          {scoreLabel} ({score > 0 ? '+' : ''}{score.toFixed(2)})
        </span>
      </div>
    </div>
  )
}

export default function AstroInsightsPanel({ astroData, visible, onToggle, ticker, matchedTopic }) {
  const [showAll, setShowAll] = useState(false)

  if (!astroData) return null

  const { available, sentiment_score, overall_summary, insights = [], total_insights, breakdown = {} } = astroData

  // matchedTopic can be a string or array of strings
  const matchedTopics = matchedTopic ? (Array.isArray(matchedTopic) ? matchedTopic : [matchedTopic]) : []
  const hasDirectMatch = matchedTopics.length > 0 && available && insights.some(i => matchedTopics.includes(i.topic))

  // Split matched vs others
  const matchedInsights = hasDirectMatch ? insights.filter(i => matchedTopics.includes(i.topic)) : []
  const otherInsights   = hasDirectMatch ? insights.filter(i => !matchedTopics.includes(i.topic)) : insights

  // 3 preview cards shown above summary; rest shown on "View All"
  const previewInsights  = matchedInsights.slice(0, 3)
  // View All order: remaining matched first (no repeat of preview), then non-matched
  const expandedInsights = [...matchedInsights.slice(3), ...otherInsights]

  // When no direct match, "View All" shows everything
  const viewAllInsights = hasDirectMatch ? expandedInsights : insights
  const showViewAll     = viewAllInsights.length > 0

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#0b0f1e', border: '1px solid #1e2d45' }}
    >
      {/* Panel header */}
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
            <div className="flex items-center">
              <span className="text-sm font-semibold tracking-wide" style={{ color: '#e2e8f0' }}>
                Astro Insights
              </span>
              {available && total_insights > 0 && (
                <span className="ml-2 text-xs" style={{ color: '#475569' }}>
                  {total_insights} signal{total_insights !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              Insights from Astrologers based on star positions · links to astrologer are included
            </div>
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: '#a5b4fc18', border: '1px solid #a5b4fc44' }}>
              <span className="text-lg">♄</span>
              <p className="text-sm font-bold" style={{ color: '#a5b4fc' }}>
                Astro Insights are best used alongside the technical &amp; fundamental analysis below.
              </p>
            </div>
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
                  className="rounded-lg p-4 space-y-2"
                  style={{ background: 'linear-gradient(135deg, #1e1b4b, #0f1a2e)', border: '1px solid #4338ca', boxShadow: '0 0 18px #3730a322' }}
                >
                  <p className="text-sm font-bold tracking-wide" style={{ color: '#a5b4fc' }}>
                    ♄ Astrological Market Outlook Summary
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                    {overall_summary}
                  </p>
                </div>
              )}

              {/* 3 most recent related insight cards — shown below summary */}
              {previewInsights.length > 0 && (
                <div className="space-y-3">
                  {previewInsights.map((insight, i) => (
                    <InsightCard key={insight.id ?? i} insight={insight} />
                  ))}
                </div>
              )}

              {/* Expanded insights (remaining matched + others, no repeats) */}
              {showAll && viewAllInsights.length > 0 && (
                <div className="space-y-3">
                  {viewAllInsights.map((insight, i) => (
                    <InsightCard key={insight.id ?? i} insight={insight} />
                  ))}
                </div>
              )}

              {/* View All / Show Less button */}
              {showViewAll && (
                showAll ? (
                  <button
                    onClick={() => setShowAll(false)}
                    className="w-full text-xs py-2 rounded transition-colors cursor-pointer"
                    style={{ background: '#111827', color: '#475569', border: '1px solid #1e2d45' }}
                  >
                    Show less
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full py-3 rounded-lg text-sm font-semibold tracking-wide transition-all cursor-pointer hover:brightness-125 active:scale-[0.99]"
                    style={{
                      background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                      color: '#a5b4fc',
                      border: '1px solid #3730a3',
                      boxShadow: '0 0 16px #3730a344',
                    }}
                  >
                    ♄ View All Astro Insights ({total_insights}) ↓
                  </button>
                )
              )}
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
