import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const OUTLOOK_COLOR = {
  bullish:  { bg: '#052e1a', border: '#10b981', text: '#34d399' },
  bearish:  { bg: '#2d0a0a', border: '#ef4444', text: '#f87171' },
  volatile: { bg: '#2d1a00', border: '#f59e0b', text: '#fbbf24' },
  cautious: { bg: '#2d1a00', border: '#f59e0b', text: '#fbbf24' },
  stable:   { bg: '#0f1a2e', border: '#94a3b8', text: '#94a3b8' },
}

const TOPIC_COLOR = {
  gold:          '#f59e0b',
  oil:           '#6b7280',
  crypto:        '#6366f1',
  banking:       '#0ea5e9',
  'tech stocks': '#8b5cf6',
  'stock market':'#10b981',
  currency:      '#06b6d4',
  war:           '#ef4444',
}

export default function PartnerPreview() {
  const { slug } = useParams()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [filterTopic, setFilterTopic]     = useState('all')
  const [filterOutlook, setFilterOutlook] = useState('all')

  useEffect(() => {
    fetch(`${API}/partner-preview/${encodeURIComponent(slug)}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [slug])

  const insights = data?.insights ?? []
  const topics   = ['all', ...Array.from(new Set(insights.map(i => i.topic))).sort()]
  const outlooks = ['all', ...Array.from(new Set(insights.map(i => i.outlook))).sort()]

  const filtered = insights.filter(i => {
    if (filterTopic !== 'all' && i.topic !== filterTopic) return false
    if (filterOutlook !== 'all' && i.outlook !== filterOutlook) return false
    return true
  })

  return (
    <div className="min-h-screen" style={{ background: '#060d18', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 22 }}>♅</span>
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6366f1' }}>StarSignal</span>
          </div>
          {loading ? (
            <div className="text-sm" style={{ color: '#475569' }}>Loading…</div>
          ) : error ? (
            <div className="text-sm" style={{ color: '#ef4444' }}>
              {error.includes('404') ? `No insights found for "${slug}".` : `Error: ${error}`}
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black mb-1" style={{ color: '#f8fafc' }}>
                {data.astrologer}
              </h1>
              <p className="text-sm" style={{ color: '#64748b' }}>
                {data.total} astrological market insight{data.total !== 1 ? 's' : ''} extracted from published content
              </p>
            </>
          )}
        </div>

        {/* Filters */}
        {!loading && !error && insights.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={filterTopic}
              onChange={e => setFilterTopic(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{ background: '#0f1a2e', border: '1px solid #1e3a5f', color: '#e2e8f0' }}
            >
              {topics.map(t => <option key={t} value={t}>{t === 'all' ? 'All topics' : t}</option>)}
            </select>
            <select
              value={filterOutlook}
              onChange={e => setFilterOutlook(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{ background: '#0f1a2e', border: '1px solid #1e3a5f', color: '#e2e8f0' }}
            >
              {outlooks.map(o => <option key={o} value={o}>{o === 'all' ? 'All outlooks' : o}</option>)}
            </select>
            <span className="text-xs self-center" style={{ color: '#475569' }}>{filtered.length} shown</span>
          </div>
        )}

        {/* Cards */}
        {!loading && !error && (
          <div className="flex flex-col gap-4">
            {filtered.length === 0 && (
              <div className="text-sm text-center py-12" style={{ color: '#475569' }}>No insights match the selected filters.</div>
            )}
            {filtered.map(insight => {
              const oc = OUTLOOK_COLOR[insight.outlook] ?? OUTLOOK_COLOR.stable
              const tc = TOPIC_COLOR[insight.topic] ?? '#94a3b8'
              return (
                <div
                  key={insight.id}
                  className="rounded-xl p-5"
                  style={{ background: '#0b1120', border: `1px solid #1e3a5f` }}
                >
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: tc + '22', color: tc, border: `1px solid ${tc}44` }}>
                      {insight.topic}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: oc.bg, color: oc.text, border: `1px solid ${oc.border}` }}>
                      {insight.outlook.toUpperCase()}
                    </span>
                    {insight.symbol && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#1e3a5f', color: '#93c5fd' }}>
                        {insight.symbol}
                      </span>
                    )}
                    <span className="text-xs ml-auto" style={{ color: '#475569' }}>{insight.confidence} confidence</span>
                  </div>

                  {/* Summary */}
                  <p className="text-sm leading-relaxed mb-3" style={{ color: '#cbd5e1' }}>{insight.summary}</p>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-4 text-xs" style={{ color: '#475569' }}>
                    <span>⏱ {insight.timeframe}</span>
                    <span>📅 {insight.published_date}</span>
                    <a
                      href={insight.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#6366f1', textDecoration: 'underline' }}
                    >
                      View original article →
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-12 text-center text-xs" style={{ color: '#1e3a5f' }}>
          Powered by StarSignal · starsignal.io
        </div>
      </div>
    </div>
  )
}
