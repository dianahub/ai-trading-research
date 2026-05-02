import { useState, useEffect, useRef, useCallback } from 'react'
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

function ActionButton({ onClick, disabled, label, desc, color, textColor, border }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-4 py-2 text-left"
      style={{ background: color, border: `1px solid ${border}`, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, minWidth: 160 }}
    >
      <div className="text-sm font-semibold" style={{ color: textColor }}>{label}</div>
      <div className="text-xs mt-0.5" style={{ color: `${textColor}99` }}>{desc}</div>
    </button>
  )
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
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [refreshing, setRefreshing]   = useState(false)
  const [reingesting, setReingesting] = useState(false)
  const [actionMsg, setActionMsg]     = useState('')
  const [polling, setPolling]           = useState(false)
  const [pollStatus, setPollStatus]     = useState('')
  const [reprocessing, setReprocessing] = useState(false)

  const pollRef          = useRef(null)
  const pollStartRef     = useRef(null)
  const baselineCountRef = useRef(null)
  const elapsedRef       = useRef(0)

  const load = useCallback(async () => {
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
  }, [])

  useEffect(() => { load() }, [load])

  // Polling loop: expire cache → fetch → check count
  const pollOnce = useCallback(async () => {
    elapsedRef.current = Math.round((Date.now() - pollStartRef.current) / 1000)

    // Expire the Python cache so we get fresh data from astro-api
    try {
      await fetch(`${API}/admin/ingest-now`, { method: 'POST', headers: adminHeaders() })
    } catch {}

    // Give the background fetch a moment to complete
    await new Promise(r => setTimeout(r, 4000))

    try {
      const r = await fetch(`${API}/admin/insights`, { headers: adminHeaders() })
      if (!r.ok) return
      const d = await r.json()
      const newCount = d.total ?? 0
      const elapsed  = elapsedRef.current

      if (newCount !== baselineCountRef.current) {
        setData(d)
        setPolling(false)
        setPollStatus(`✓ Done — ${newCount} insights (was ${baselineCountRef.current})`)
      } else if (elapsed >= 480) {
        setData(d)
        setPolling(false)
        setPollStatus('8 minutes elapsed — insight count unchanged. Ingestion may have found no new articles.')
      } else {
        setPollStatus(`Checking… ${elapsed}s elapsed`)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!polling) {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(pollOnce, 15000)
    return () => clearInterval(pollRef.current)
  }, [polling, pollOnce])

  async function syncCache() {
    setRefreshing(true)
    setActionMsg('')
    setPolling(false)
    setPollStatus('')
    try {
      const r = await fetch(`${API}/admin/ingest-now`, { method: 'POST', headers: adminHeaders() })
      const j = await r.json()
      setActionMsg(j.message ?? 'Cache refreshed.')
      setTimeout(load, 3000)
    } catch (e) {
      setActionMsg(`Error: ${e.message}`)
    } finally {
      setRefreshing(false)
    }
  }

  async function reprocessAll() {
    if (!window.confirm('This will delete all existing insights and re-run Claude extraction on every article. Continue?')) return
    setReprocessing(true)
    setActionMsg('')
    setPollStatus('')
    try {
      const r = await fetch(`${API}/admin/astro-reprocess-all`, { method: 'POST', headers: adminHeaders() })
      const j = await r.json()
      if (r.ok) {
        baselineCountRef.current = 0
        pollStartRef.current     = Date.now()
        elapsedRef.current       = 0
        setPollStatus(`Reprocessing all articles — checking every 15s…`)
        setPolling(true)
      } else {
        setActionMsg(j.detail ?? 'Failed to start reprocess.')
      }
    } catch (e) {
      setActionMsg(`Error: ${e.message}`)
    } finally {
      setReprocessing(false)
    }
  }

  async function rerunIngestion() {
    setReingesting(true)
    setActionMsg('')
    setPollStatus('')
    try {
      const r = await fetch(`${API}/admin/astro-reingest`, { method: 'POST', headers: adminHeaders() })
      const j = await r.json()
      if (r.ok) {
        baselineCountRef.current = data?.total ?? 0
        pollStartRef.current     = Date.now()
        elapsedRef.current       = 0
        setPollStatus('Ingestion started — checking for updates every 15s…')
        setPolling(true)
      } else {
        setActionMsg(j.detail ?? 'Failed to start ingestion.')
      }
    } catch (e) {
      setActionMsg(`Error: ${e.message}`)
    } finally {
      setReingesting(false)
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
        <div className="flex items-center gap-4 mb-8">
          <Link to="/admin" className="text-xs" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>
          <Link to="/admin/insights-audit" className="text-xs" style={{ color: '#6366f1', textDecoration: 'none' }}>Audit all cards →</Link>
        </div>
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
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap gap-2 justify-end">
              <ActionButton
                onClick={load}
                disabled={loading}
                label={loading ? 'Loading…' : 'Reload'}
                desc="Show what's in cache now"
                color="#1e2d45"
                textColor="#e2e8f0"
                border="#334155"
              />
              <ActionButton
                onClick={syncCache}
                disabled={refreshing}
                label={refreshing ? 'Syncing…' : 'Sync Cache'}
                desc="Pull latest from astro-api"
                color="#0c2541"
                textColor="#7dd3fc"
                border="#1e4976"
              />
              <ActionButton
                onClick={rerunIngestion}
                disabled={reingesting || polling}
                label={reingesting ? 'Starting…' : polling ? '♅ Ingestion Running…' : '♅ Re-run Ingestion'}
                desc="New articles only — skips articles already processed"
                color="#1c1208"
                textColor="#fbbf24"
                border="#78350f"
              />
              <ActionButton
                onClick={reprocessAll}
                disabled={reprocessing || polling}
                label={reprocessing ? 'Starting…' : '⚠ Reprocess All'}
                desc="Re-runs ALL articles incl. already-processed — use this to backfill raw text or fix prompts"
                color="#1a0a1a"
                textColor="#e879f9"
                border="#6b21a8"
              />
            </div>

            {/* Polling status */}
            {polling && (
              <div className="flex items-center gap-2 mt-1" style={{ maxWidth: 360 }}>
                <span
                  style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', flexShrink: 0,
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
                <p className="text-xs" style={{ color: '#fbbf24' }}>{pollStatus}</p>
              </div>
            )}

            {/* One-shot action message (non-polling) */}
            {!polling && (actionMsg || pollStatus) && (
              <p className="text-xs" style={{
                color: pollStatus.startsWith('✓') ? '#10b981' : '#94a3b8',
                maxWidth: 360,
                textAlign: 'right',
              }}>
                {pollStatus || actionMsg}
              </p>
            )}
          </div>
        </div>

        <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>

        {error && (
          <div className="rounded-lg px-4 py-3 mb-6 text-sm" style={{ background: '#1f0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {loading && !data && (
          <p className="text-sm" style={{ color: '#94a3b8' }}>Loading insights…</p>
        )}

        {!loading && grouped.length === 0 && !error && (
          <p className="text-sm" style={{ color: '#94a3b8' }}>No insights cached yet. Try Sync Cache to pull from astro-api, or Re-run Ingestion to re-scrape feeds.</p>
        )}

        {grouped.map(([name, insights]) => (
          <AstrologerGroup key={name} name={name} insights={insights} />
        ))}
      </div>
    </div>
  )
}
