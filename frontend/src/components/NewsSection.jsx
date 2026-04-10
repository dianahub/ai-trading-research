import { ExternalLink, Newspaper } from 'lucide-react'

const SENTIMENT_CONFIG = {
  bullish: { label: 'BULLISH', color: '#10b981', bg: '#052e16', border: '#065f46' },
  bearish: { label: 'BEARISH', color: '#ef4444', bg: '#1f0a0a', border: '#7f1d1d' },
  neutral: { label: 'NEUTRAL', color: '#f59e0b', bg: '#1c1408', border: '#78350f' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NewsSection({ news, newsSentiment }) {
  const articles = news?.articles ?? []
  const ticker = news?.ticker ?? ''
  const cfg = SENTIMENT_CONFIG[newsSentiment] ?? null

  return (
    <div className="rounded-xl" style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid #1e2d45' }}>
        <div className="flex items-center gap-2">
          <Newspaper size={15} style={{ color: '#475569' }} />
          <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#475569' }}>
            {ticker} · Recent News
          </h3>
        </div>
        {cfg && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cfg.color }} />
            News Sentiment: {cfg.label}
          </div>
        )}
      </div>

      {/* Articles */}
      <div className="divide-y" style={{ borderColor: '#1e2d45' }}>
        {articles.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: '#475569' }}>
            No articles found. Check NEWS_API_KEY configuration.
          </div>
        ) : articles.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-5 py-3.5 group transition-colors hover:bg-[#0f1629]"
          >
            {/* Index */}
            <span className="text-xs font-mono w-5 shrink-0 mt-0.5" style={{ color: '#2a3f5f' }}>
              {String(i + 1).padStart(2, '0')}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-cyan-400 transition-colors"
                style={{ color: '#e2e8f0' }}>
                {article.title}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>
                  {article.source}
                </span>
                <span className="text-xs" style={{ color: '#475569' }}>
                  {timeAgo(article.published_at)}
                </span>
              </div>
            </div>

            {/* External link icon */}
            <ExternalLink size={13} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: '#06b6d4' }} />
          </a>
        ))}
      </div>
    </div>
  )
}
