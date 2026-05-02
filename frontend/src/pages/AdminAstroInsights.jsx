import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-admin-email':    'contact@starsignal.io',
    'x-admin-password': 'BISCUITLOVE',
  }
}

const OUTLOOK_COLOR = {
  bullish:  '#10b981',
  bearish:  '#ef4444',
  volatile: '#f59e0b',
  cautious: '#f59e0b',
  stable:   '#94a3b8',
}

function OutlookBadge({ outlook }) {
  const color = OUTLOOK_COLOR[outlook?.toLowerCase()] ?? '#94a3b8'
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-bold tracking-wider"
      style={{ color, background: `${color}22`, border: `1px solid ${color}55` }}
    >
      {(outlook ?? 'unknown').toUpperCase()}
    </span>
  )
}

function InsightRow({ insight }) {
  return (
    <div className="py-3 border-b" style={{ borderColor: '#1e2d45' }}>
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <OutlookBadge outlook={insight.outlook} />
        <span
          className="px-2 py-0.5 rounded text-xs font-mono"
          style={{ background: '#111827', color: '#94a3b8', border: '1px solid #1e2d45' }}
        >
          {(insight.topic ?? '—').toUpperCase()}
        </span>
        {insight.symbol && (
          <span
            className="px-2 py-0.5 rounded text-xs font-bold font-mono"
            style={{ background: '#0c2a1e', color: '#34d399', border: '1px solid #065f4655' }}
          >
            {insight.symbol}
          </span>
        )}
        <span className="text-xs" style={{ color: '#64748b' }}>{insight.timeframe}</span>
      </div>
      <p className="text-sm leading-relaxed mb-1.5" style={{ color: '#cbd5e1' }}>
        {insight.summary}
      </p>
      <a
        href={insight.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs hover:underline"
        style={{ color: '#38bdf8' }}
      >
        {insight.source_url}
      </a>
    </div>
  )
}

function AstrologerGroup({ name, insights }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #1e2d45', background: '#0b1120' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer"
        style={{ background: '#0f1a2e' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: '#f1f5f9' }}>{name}</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: '#1e2d45', color: '#94a3b8' }}
          >
            {insights.length} insight{insights.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5">
          {insights.map((ins, i) => <InsightRow key={ins.id ?? i} insight={ins} />)}
        </div>
      )}
    </div>
  )
}

export default function AdminAstroInsights() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${API}/admin/insights`, { headers: adminHeaders() })
      if (!r.ok) throw new Error(`${r.status}`)
      setData(await r.json())
    } catch (e) {
      setError(`Failed to load: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function forceRefresh() {
    setRefreshing(true)
    setRefreshMsg('')
    try {
      const r = await fetch(`${API}/admin/ingest-now`, { method: 'POST', headers: adminHeaders() })
      const j = await r.json()
      setRefreshMsg(j.message ?? 'Ingestion started — check back in a few minutes.')
    } catch (e) {
      setRefreshMsg(`Error: ${e.message}`)
    } finally {
      setRefreshing(false)
    }
  }

  // Group insights by source_name
  const grouped = data
    ? Object.entries(
        (data.insights ?? []).reduce((acc, ins) => {
          const key = ins.source_name ?? 'Unknown'
          if (!acc[key]) acc[key] = []
          acc[key].push(ins)
          return acc
        }, {})
      ).sort((a, b) => b[1].length - a[1].length)
    : []

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link to="/admin" className="text-xs mb-8 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>
          ← Admin
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black mb-1" style={{ color: '#f1f5f9' }}>Astro Insights</h1>
            {data && (
              <p className="text-sm" style={{ color: '#94a3b8' }}>
                {data.total} insight{data.total !== 1 ? 's' : ''} cached
                {data.last_fetch && ` · last fetched ${new Date(data.last_fetch).toLocaleString()}`}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: '#1e2d45', color: '#e2e8f0', border: '1px solid #334155', cursor: loading ? 'default' : 'pointer' }}
              >
                {loading ? 'Loading…' : 'Reload'}
              </button>
              <button
                onClick={forceRefresh}
                disabled={refreshing}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', color: '#a5b4fc', border: '1px solid #3730a3', cursor: refreshing ? 'default' : 'pointer' }}
              >
                {refreshing ? 'Starting…' : '♅ Force Refresh'}
              </button>
            </div>
            {refreshMsg && (
              <p className="text-xs" style={{ color: '#94a3b8', maxWidth: 300, textAlign: 'right' }}>{refreshMsg}</p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 mb-6 text-sm" style={{ background: '#1f0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {loading && !data && (
          <p className="text-sm" style={{ color: '#94a3b8' }}>Loading insights…</p>
        )}

        {!loading && grouped.length === 0 && !error && (
          <p className="text-sm" style={{ color: '#94a3b8' }}>No insights cached yet. Try Force Refresh.</p>
        )}

        {grouped.map(([name, insights]) => (
          <AstrologerGroup key={name} name={name} insights={insights} />
        ))}
      </div>
    </div>
  )
}
