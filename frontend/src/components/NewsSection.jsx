import { useState, useEffect } from 'react'
import { ExternalLink, Newspaper, ChevronDown } from 'lucide-react'

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
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#news') setOpen(true)
    }
    const handleOpen = (e) => { if (e.detail === '#news') setOpen(true) }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    window.addEventListener('open-section', handleOpen)
    return () => {
      window.removeEventListener('hashchange', handleHash)
      window.removeEventListener('open-section', handleOpen)
    }
  }, [])
  const articles = news?.articles ?? []
  const ticker = news?.ticker ?? ''
  const cfg = SENTIMENT_CONFIG[newsSentiment] ?? null

  return (
    <div className="rounded-xl" style={{ background: '#0c2a3f', border: '1px solid #38bdf8' }}>
      {/* Header — always visible, acts as accordion toggle */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: open ? '1px solid #38bdf844' : 'none' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Newspaper size={16} style={{ color: '#e2e8f0' }} />
          <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: '#e2e8f0' }}>
            {ticker} · Recent News
          </h3>
          {cfg && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cfg.color }} />
              {cfg.label}
            </div>
          )}
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
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1e3a5f'}
          onMouseLeave={e => { if (!open) e.currentTarget.style.background = '#0f1a2e' }}
        >
          <span>{open ? 'HIDE' : 'SHOW'}</span>
          <ChevronDown
            size={15}
            style={{
              color: '#06b6d4',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      </div>

      {/* Articles — collapsed by default */}
      {open && (
        <div className="divide-y" style={{ borderColor: '#1e2d45' }}>
          {articles.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm" style={{ color: '#94a3b8' }}>
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
              <span className="text-xs font-mono w-5 shrink-0 mt-0.5" style={{ color: '#2a3f5f' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-cyan-400 transition-colors"
                  style={{ color: '#e2e8f0' }}>
                  {article.title}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{article.source}</span>
                  <span className="text-xs" style={{ color: '#94a3b8' }}>{timeAgo(article.published_at)}</span>
                </div>
              </div>
              <ExternalLink size={13} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: '#06b6d4' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
