import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const CONFIG = {
  bullish: {
    label: 'BULLISH',
    icon: TrendingUp,
    bg: 'linear-gradient(135deg, #052e16 0%, #0a1a2e 100%)',
    border: '#065f46',
    color: '#10b981',
    glow: '0 0 40px rgba(16,185,129,0.12)',
    dot: '#10b981',
  },
  bearish: {
    label: 'BEARISH',
    icon: TrendingDown,
    bg: 'linear-gradient(135deg, #1f0a0a 0%, #1a0a1a 100%)',
    border: '#7f1d1d',
    color: '#ef4444',
    glow: '0 0 40px rgba(239,68,68,0.12)',
    dot: '#ef4444',
  },
  neutral: {
    label: 'NEUTRAL',
    icon: Minus,
    bg: 'linear-gradient(135deg, #1c1408 0%, #1a1a0a 100%)',
    border: '#78350f',
    color: '#f59e0b',
    glow: '0 0 40px rgba(245,158,11,0.12)',
    dot: '#f59e0b',
  },
}

export default function SentimentBanner({ analysis, ticker }) {
  const sentiment = analysis?.overall_sentiment ?? 'neutral'
  const cfg = CONFIG[sentiment] ?? CONFIG.neutral
  const Icon = cfg.icon
  const confidence = analysis?.confidence_score ?? 0

  return (
    <div className="rounded-xl p-5" style={{
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      boxShadow: cfg.glow,
    }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: sentiment label */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${cfg.color}22`, border: `1px solid ${cfg.border}` }}>
            <Icon size={22} style={{ color: cfg.color }} />
          </div>
          <div>
            <div className="text-sm font-semibold mb-0.5" style={{ color: '#94a3b8' }}>
              {ticker} · AI Sentiment
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: cfg.color }}>
              {cfg.label}
            </div>
          </div>
        </div>

        {/* Center: confidence meter */}
        <div className="flex-1 sm:px-10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs uppercase tracking-widest" style={{ color: '#94a3b8' }}>
              Confidence Score
            </span>
            <span className="text-lg font-mono font-bold" style={{ color: cfg.color }}>
              {confidence}<span className="text-sm font-normal" style={{ color: '#94a3b8' }}>/10</span>
            </span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: '#1e2d45' }}>
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${confidence * 10}%`,
                background: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})`,
                boxShadow: `0 0 8px ${cfg.color}66`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="text-xs" style={{ color: i < confidence ? cfg.color : '#2a3f5f' }}>|</div>
            ))}
          </div>
        </div>

        {/* Right: dot indicator */}
        <div className="flex items-center gap-2 text-xs" style={{ color: '#94a3b8' }}>
          <span className="w-2.5 h-2.5 rounded-full inline-block pulse-glow"
            style={{ background: cfg.dot }} />
          AI Analysis Complete
        </div>
      </div>
    </div>
  )
}
