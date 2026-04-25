// AstroInsightsPanel.jsx
// Displays financial astrology insights from the Astro API microservice.
import { useState, useMemo } from 'react'

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

function MoodIllustration({ score }) {
  const s = parseFloat(score) || 0
  if (s > 0.1) return (
    // Bullish: glowing sun
    <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="20" fill="#f59e0b" opacity="0.12"/>
      <g stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round">
        <line x1="32" y1="4" x2="32" y2="12"/>
        <line x1="32" y1="52" x2="32" y2="60"/>
        <line x1="4" y1="32" x2="12" y2="32"/>
        <line x1="52" y1="32" x2="60" y2="32"/>
        <line x1="11.5" y1="11.5" x2="17.2" y2="17.2"/>
        <line x1="46.8" y1="46.8" x2="52.5" y2="52.5"/>
        <line x1="52.5" y1="11.5" x2="46.8" y2="17.2"/>
        <line x1="17.2" y1="46.8" x2="11.5" y2="52.5"/>
      </g>
      <circle cx="32" cy="32" r="12" fill="#f59e0b" opacity="0.9"/>
      <circle cx="32" cy="32" r="8" fill="#fde68a"/>
    </svg>
  )
  if (s < -0.1) return (
    // Bearish: storm cloud with lightning bolt
    <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
      <path d="M14 36 Q12 26 22 24 Q24 14 36 14 Q50 14 50 26 Q58 26 58 36 Q58 44 50 44 H16 Q8 44 14 36Z" fill="#334155" opacity="0.9"/>
      <path d="M36 26 L27 38 H33 L25 52 L43 34 H37 L43 26Z" fill="#ef4444" opacity="0.9"/>
    </svg>
  )
  return (
    // Neutral: Libra balance scales
    <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
      <line x1="32" y1="10" x2="32" y2="54" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="10" y1="20" x2="54" y2="20" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="32" cy="20" r="2.5" fill="#94a3b8"/>
      <line x1="15" y1="20" x2="12" y2="36" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="15" y1="20" x2="22" y2="36" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="49" y1="20" x2="42" y2="36" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="49" y1="20" x2="56" y2="36" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 36 Q17 42 24 36" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M40 36 Q47 42 54 36" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <line x1="22" y1="54" x2="42" y2="54" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
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
      <span className="text-xs" style={{ color: '#94a3b8' }}>Astrologer's confidence in this signal</span>
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
      <div className="flex justify-between text-xs" style={{ color: '#94a3b8' }}>
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
            style={{ background: '#111827', color: '#94a3b8', border: '1px solid #1e2d45' }}
          >
            {insight.topic?.toUpperCase()}
          </span>
          <span className="text-xs font-medium" style={{ color: '#cbd5e1' }}>
            {insight.timeframe}
          </span>
          {insight.trend_type && isDateRange(insight.timeframe) && (
            <span
              className="px-2 py-0.5 rounded text-xs tracking-wider"
              style={{
                background: insight.trend_type === 'Short Term Trend' ? '#0c1a2e' : '#1a0c2e',
                color:      insight.trend_type === 'Short Term Trend' ? '#38bdf8' : '#a78bfa',
                border:     `1px solid ${insight.trend_type === 'Short Term Trend' ? '#0369a1' : '#6d28d9'}`,
              }}
            >
              {insight.trend_type}
            </span>
          )}
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
          className="ml-4 text-xs shrink-0 font-semibold hover:underline transition-colors"
          style={{ color: '#94a3b8' }}
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
          ♅ Direct Astro Coverage
        </span>
        <span className="text-xs font-mono font-semibold" style={{ color: '#94a3b8' }}>
          {ticker} → {topic.toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span style={{ color: '#94a3b8' }}>{topicInsights.length} signal{topicInsights.length !== 1 ? 's' : ''}</span>
        <span className="font-semibold" style={{ color: scoreColor }}>
          {scoreLabel} ({score > 0 ? '+' : ''}{score.toFixed(2)})
        </span>
      </div>
    </div>
  )
}

function isDateRange(timeframe) {
  return /[-–]/.test(timeframe ?? '')
}

function isFutureOrCurrent(timeframe) {
  if (!timeframe) return true
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const MONTHS = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12 }
  // Extract all 4-digit years and month names to find the latest date mentioned
  const year = parseInt((timeframe.match(/\b(20\d{2})\b/) || [])[1]) || today.getFullYear()
  // Find last day number in string
  const nums = [...timeframe.matchAll(/\b(\d{1,2})\b/g)].map(m => parseInt(m[1])).filter(n => n >= 1 && n <= 31)
  const monthNames = Object.keys(MONTHS)
  const months = monthNames.filter(m => timeframe.toLowerCase().includes(m))
  if (months.length === 0) {
    // e.g. bare year "2026"
    return new Date(year, 11, 31) >= today
  }
  const lastMonth = MONTHS[months[months.length - 1]]
  const lastDay = nums.length > 0 ? nums[nums.length - 1] : new Date(year, lastMonth, 0).getDate()
  const endDate = new Date(year, lastMonth - 1, lastDay)
  return endDate >= today
}

function pickOnePerAstrologer(pool, max = 3) {
  const seen = new Set()
  const picked = []
  for (const insight of pool) {
    if (!seen.has(insight.source_name)) {
      seen.add(insight.source_name)
      picked.push(insight)
      if (picked.length === max) break
    }
  }
  if (picked.length < max) {
    for (const insight of pool) {
      if (!picked.includes(insight)) {
        picked.push(insight)
        if (picked.length === max) break
      }
    }
  }
  return picked
}

function deduplicateSimilar(pool) {
  const JACCARD_THRESHOLD = 0.45
  const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 }
  function words(text) {
    return new Set((text ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean))
  }
  function jaccard(a, b) {
    const wa = words(a); const wb = words(b)
    const intersection = [...wa].filter(w => wb.has(w)).length
    const union = new Set([...wa, ...wb]).size
    return union === 0 ? 0 : intersection / union
  }
  function isSimilar(a, b) {
    if (a.topic === b.topic && a.outlook === b.outlook && a.timeframe === b.timeframe) return true
    return jaccard(a.summary, b.summary) >= JACCARD_THRESHOLD
  }
  const sorted = [...pool].sort(
    (a, b) => (CONFIDENCE_RANK[b.confidence] ?? 0) - (CONFIDENCE_RANK[a.confidence] ?? 0)
  )
  const kept = []
  for (const candidate of sorted) {
    if (!kept.some(k => isSimilar(k, candidate))) kept.push(candidate)
  }
  return kept
}

export default function AstroInsightsPanel({ astroData, visible, onToggle, ticker, matchedTopic }) {
  const [visibleCount, setVisibleCount] = useState(0)

  function loadMore() {
    setVisibleCount(c => c + 10)
  }

  const { available, sentiment_score, overall_summary, insights: rawInsights = [], total_insights, breakdown = {} } = astroData ?? {}

  // All expensive filtering/dedup runs only when astroData or matchedTopic changes
  const { previewInsights, viewAllInsights } = useMemo(() => {
    const matchedTopics = matchedTopic ? (Array.isArray(matchedTopic) ? matchedTopic : [matchedTopic]) : []
    const insights = (rawInsights ?? []).filter(i => isFutureOrCurrent(i.timeframe))
    const hasDirectMatch = matchedTopics.length > 0 && available && insights.some(i => matchedTopics.includes(i.topic))
    const matchedInsights = hasDirectMatch ? insights.filter(i => matchedTopics.includes(i.topic)) : []
    const otherInsights   = hasDirectMatch ? insights.filter(i => !matchedTopics.includes(i.topic)) : insights
    const previewPool     = hasDirectMatch ? matchedInsights : insights
    const preview         = pickOnePerAstrologer(previewPool, 3)
    const previewIds      = new Set(preview.map(i => i.id ?? i.summary))
    const expandedRaw     = [
      ...matchedInsights.filter(i => !previewIds.has(i.id ?? i.summary)),
      ...otherInsights,
    ]
    const viewAll = hasDirectMatch
      ? deduplicateSimilar(expandedRaw)
      : deduplicateSimilar(insights.filter(i => !previewIds.has(i.id ?? i.summary)))
    return { previewInsights: preview, viewAllInsights: viewAll }
  }, [rawInsights, matchedTopic, available])

  if (!astroData) return null

  const showViewAll = viewAllInsights.length > 0

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
            ♅
          </div>
          <div>
            <div className="flex items-center">
              <span className="text-sm font-semibold tracking-wide" style={{ color: '#e2e8f0' }}>
                Astro Insights
              </span>
              {available && total_insights > 0 && (
                <span className="ml-2 text-xs" style={{ color: '#94a3b8' }}>
                  {total_insights} signal{total_insights !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
              Insights from Astrologers based on star positions · links to astrologer are included
            </div>
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: '#a5b4fc18', border: '1px solid #a5b4fc44' }}>
              <span className="text-lg">♅</span>
              <p className="text-sm font-bold" style={{ color: '#a5b4fc' }}>
                Astro Insights are best used alongside the technical &amp; fundamental analysis below.
              </p>
            </div>
          </div>
          {!available && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1e2d45', color: '#94a3b8' }}>
              Service offline
            </span>
          )}
        </div>

        <button
          onClick={onToggle}
          className="text-xs px-3 py-1 rounded transition-colors cursor-pointer"
          style={{
            background: visible ? '#1e2d45' : '#111827',
            color: '#94a3b8',
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
            <p className="text-sm text-center py-6" style={{ color: '#94a3b8' }}>
              Astro API is currently unreachable. Insights will appear when the service is available.
            </p>
          ) : total_insights === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#94a3b8' }}>
              We're currently updating our astro insights — check back in a few minutes.
            </p>
          ) : (
            <>

              {/* Sentiment gauge — only when ticker has no mapped category */}
              {matchedTopics.length === 0 && <SentimentGauge score={sentiment_score} />}

              {/* Overall summary */}
              {overall_summary && (() => {
                const bullets = overall_summary
                  .split('\n')
                  .map(l => l.replace(/^[\s•\-\*\d\.]+/, '').trim())
                  .filter(l => l.length > 10)
                return (
                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'linear-gradient(135deg, #1e1b4b, #0f1a2e)', border: '1px solid #4338ca', boxShadow: '0 0 18px #3730a322' }}
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <MoodIllustration score={sentiment_score} />
                      <p className="text-sm font-bold tracking-wide" style={{ color: '#a5b4fc' }}>
                        ♅ Astrological Market Outlook Summary
                      </p>
                    </div>
                    {bullets.length > 1 ? (
                      <ul className="space-y-2">
                        {bullets.map((b, i) => (
                          <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                            <span style={{ color: '#6366f1', flexShrink: 0 }}>•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{overall_summary}</p>
                    )}
                  </div>
                )
              })()}

              {/* 3 most recent related insight cards — shown below summary */}
              {previewInsights.length > 0 && (
                <div className="space-y-3">
                  {previewInsights.map((insight, i) => (
                    <InsightCard key={insight.id ?? i} insight={insight} />
                  ))}
                </div>
              )}

              {/* Incrementally loaded insights */}
              {visibleCount > 0 && viewAllInsights.length > 0 && (
                <div className="space-y-3">
                  {viewAllInsights.slice(0, visibleCount).map((insight, i) => (
                    <InsightCard key={insight.id ?? i} insight={insight} />
                  ))}
                </div>
              )}

              {/* Load more / Show less */}
              {showViewAll && (() => {
                const remaining = viewAllInsights.length - visibleCount
                const allLoaded = visibleCount >= viewAllInsights.length
                return allLoaded ? (
                  <button
                    onClick={() => setVisibleCount(0)}
                    className="w-full text-xs py-2 rounded transition-colors cursor-pointer"
                    style={{ background: '#111827', color: '#94a3b8', border: '1px solid #1e2d45' }}
                  >
                    Show less
                  </button>
                ) : (
                  <button
                    onClick={loadMore}
                    className="w-full py-3 rounded-lg text-sm font-semibold tracking-wide transition-all cursor-pointer hover:brightness-125 active:scale-[0.99]"
                    style={{
                      background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                      color: '#a5b4fc',
                      border: '1px solid #3730a3',
                      boxShadow: '0 0 16px #3730a344',
                    }}
                  >
                    {`♅ See ${Math.min(10, remaining)} more insight${Math.min(10, remaining) !== 1 ? 's' : ''} ↓`}
                  </button>
                )
              })()}
            </>
          )}

          {/* Disclaimer */}
          <p className="text-xs pt-2" style={{ color: '#94a3b8', borderTop: '1px solid #1e2d45', paddingTop: 12 }}>
            ♅ Astrological insights are alternative data for informational purposes only and do not constitute investment advice.
          </p>
        </div>
      )}
    </div>
  )
}
