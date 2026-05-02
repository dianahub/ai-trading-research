import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-admin-email':    'contact@starsignal.io',
    'x-admin-password': 'BISCUITLOVE',
  }
}

const OUTLOOK_COLOR = {
  bullish:  { bg: '#052e1a', border: '#10b981', text: '#34d399' },
  bearish:  { bg: '#2d0a0a', border: '#ef4444', text: '#f87171' },
  volatile: { bg: '#2d1a00', border: '#f59e0b', text: '#fbbf24' },
  cautious: { bg: '#2d1a00', border: '#f59e0b', text: '#fbbf24' },
  stable:   { bg: '#0f1a2e', border: '#94a3b8', text: '#94a3b8' },
}

const TOPIC_COLOR = {
  gold:         '#f59e0b',
  oil:          '#6b7280',
  crypto:       '#6366f1',
  banking:      '#0ea5e9',
  'tech stocks':'#8b5cf6',
  'stock market':'#10b981',
  currency:     '#06b6d4',
  war:          '#ef4444',
}

export default function AdminInsightsAudit() {
  const { slug } = useParams()  // e.g. "rowan" from /admin/insights-audit/rowan
  const [insights, setInsights]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [expanded, setExpanded]     = useState(null)
  const [filterTopic, setFilterTopic]   = useState('all')
  const [filterOutlook, setFilterOutlook] = useState('all')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    fetch(`${API}/admin/astro-insights-db`, { headers: adminHeaders() })
      .then(r => r.json())
      .then(d => { setInsights(d.insights ?? []); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  // When slug is present, pre-filter to that astrologer by source_name
  const slugLower = slug?.toLowerCase() ?? null
  const byAstrologer = slugLower
    ? insights.filter(i => i.source_name?.toLowerCase().includes(slugLower))
    : insights

  // Matched astrologer display name (first result's source_name)
  const astrologerName = byAstrologer[0]?.source_name ?? slug

  const topics  = ['all', ...Array.from(new Set(byAstrologer.map(i => i.topic))).sort()]
  const outlooks = ['all', ...Array.from(new Set(byAstrologer.map(i => i.outlook))).sort()]

  const filtered = byAstrologer.filter(i => {
    if (filterTopic !== 'all' && i.topic !== filterTopic) return false
    if (filterOutlook !== 'all' && i.outlook !== filterOutlook) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        i.summary?.toLowerCase().includes(q) ||
        i.source_name?.toLowerCase().includes(q) ||
        i.symbol?.toLowerCase().includes(q) ||
        i.timeframe?.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="min-h-screen" style={{ background: '#060d18', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 text-xs mb-1">
              <Link to="/admin/astro-insights" style={{ color: '#6366f1' }}>← Astro Controls</Link>
              {slug && <Link to="/admin/insights-audit" style={{ color: '#475569' }}>All Astrologers</Link>}
            </div>
            <h1 className="text-xl font-bold" style={{ color: '#f8fafc' }}>
              {slug ? `${astrologerName} — Insights` : 'Insights Audit'}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {byAstrologer.length} insight{byAstrologer.length !== 1 ? 's' : ''}
              {slug ? ` from ${astrologerName}` : ` across all astrologers`}
              {' · source URL · article text used for extraction'}
            </p>
          </div>
          <div className="text-right text-xs" style={{ color: '#475569' }}>
            {loading ? 'Loading…' : `${filtered.length} shown`}
          </div>
        </div>

        {error && (
          <div className="rounded-lg p-4 mb-6 text-sm" style={{ background: '#2d0a0a', border: '1px solid #ef4444', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search summary, source, symbol…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48"
            style={{ background: '#0f1a2e', border: '1px solid #1e3a5f', color: '#e2e8f0', outline: 'none' }}
          />
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
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: '#475569' }}>Loading insights from database…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: '#475569' }}>No insights match filters.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(insight => {
              const oc = OUTLOOK_COLOR[insight.outlook] ?? OUTLOOK_COLOR.stable
              const tc = TOPIC_COLOR[insight.topic] ?? '#94a3b8'
              const isOpen = expanded === insight.id

              return (
                <div
                  key={insight.id}
                  className="rounded-xl overflow-hidden"
                  style={{ background: '#0b1120', border: `1px solid ${isOpen ? oc.border : '#1e3a5f'}` }}
                >
                  {/* Row */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : insight.id)}
                  >
                    <div className="flex flex-wrap items-start gap-2 mb-2">
                      {/* Topic pill */}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: tc + '22', color: tc, border: `1px solid ${tc}44` }}>
                        {insight.topic}
                      </span>
                      {/* Outlook pill */}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: oc.bg, color: oc.text, border: `1px solid ${oc.border}` }}>
                        {insight.outlook.toUpperCase()}
                      </span>
                      {/* Symbol */}
                      {insight.symbol && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#1e3a5f', color: '#93c5fd' }}>
                          {insight.symbol}
                        </span>
                      )}
                      {/* Confidence */}
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1e293b', color: '#64748b' }}>
                        {insight.confidence} confidence
                      </span>
                      <span className="ml-auto text-xs" style={{ color: '#475569' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>

                    {/* Summary */}
                    <p className="text-sm leading-relaxed mb-2" style={{ color: '#cbd5e1' }}>{insight.summary}</p>

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-4 text-xs" style={{ color: '#475569' }}>
                      <span>⏱ {insight.timeframe}</span>
                      <span>📅 {insight.published_date}</span>
                      <span>
                        🔗 <a
                          href={insight.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ color: '#6366f1', textDecoration: 'underline' }}
                        >
                          {insight.source_name}
                        </a>
                      </span>
                    </div>
                  </div>

                  {/* Expanded: URL + raw text */}
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${oc.border}44`, background: '#060d18' }}>
                      {/* URL */}
                      <div className="px-4 pt-4 pb-2">
                        <div className="text-xs font-semibold mb-1" style={{ color: '#475569' }}>SOURCE URL</div>
                        <a
                          href={insight.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs break-all"
                          style={{ color: '#6366f1' }}
                        >
                          {insight.source_url}
                        </a>
                      </div>

                      {/* Raw text */}
                      <div className="px-4 pb-4">
                        <div className="text-xs font-semibold mb-1 mt-3" style={{ color: '#475569' }}>
                          ARTICLE TEXT USED FOR EXTRACTION
                          {!insight.raw_text && <span className="ml-2 font-normal" style={{ color: '#374151' }}>(not stored — only available for insights ingested after this update)</span>}
                        </div>
                        {insight.raw_text ? (
                          <pre
                            className="text-xs leading-relaxed whitespace-pre-wrap rounded-lg p-3 overflow-auto max-h-64"
                            style={{ background: '#0f1a2e', border: '1px solid #1e3a5f', color: '#94a3b8', fontFamily: 'monospace' }}
                          >
                            {insight.raw_text}
                          </pre>
                        ) : (
                          <div className="text-xs rounded-lg p-3" style={{ background: '#0f1a2e', border: '1px solid #1e293b', color: '#374151' }}>
                            Raw text not available. Re-run ingestion or Reprocess All to populate this for new articles.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
