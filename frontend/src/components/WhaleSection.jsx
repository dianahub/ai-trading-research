import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ── Ocean palette ────────────────────────────────────────────────────────────
const OCEAN = {
  bg:         '#020d1a',
  bgCard:     '#06111f',
  border:     '#0d3a5c',
  borderGlow: '#0e4d7a',
  teal:       '#0d9488',
  cyan:       '#06b6d4',
  deepBlue:   '#1e3a5f',
  muted:      '#4a7fa5',
  text:       '#a8d4f0',
  textDim:    '#4a7fa5',
}

const DIRECTION_CONFIG = {
  'Exchange Inflow': {
    color: '#ef4444',
    bg:    '#1f0a0a',
    label: 'INFLOW',
  },
  'Exchange Outflow': {
    color: '#10b981',
    bg:    '#052e16',
    label: 'OUTFLOW',
  },
  'Whale Transfer': {
    color: OCEAN.cyan,
    bg:    '#031220',
    label: 'TRANSFER',
  },
}

const SENTIMENT_CONFIG = {
  bullish: { color: '#10b981', border: '#065f46', label: 'BULLISH' },
  bearish: { color: '#ef4444', border: '#7f1d1d', label: 'BEARISH' },
  neutral: { color: OCEAN.cyan,  border: OCEAN.border, label: 'NEUTRAL' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUsd(n) {
  if (n == null) return '—'
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${Number(n).toLocaleString()}`
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function shortHash(hash) {
  if (!hash) return '—'
  return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SentimentBadge({ label, sentiment }) {
  const cfg = SENTIMENT_CONFIG[sentiment] ?? SENTIMENT_CONFIG.neutral
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold tracking-wider"
      style={{
        background: `${cfg.color}18`,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
      }}
    >
      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: cfg.color }} />
      {cfg.label}
      {label && (
        <span className="text-xs font-normal opacity-70 ml-1">— {label}</span>
      )}
    </div>
  )
}

const InflowOutflowTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs font-mono"
      style={{ background: '#0a1628', border: `1px solid ${OCEAN.border}`, color: OCEAN.text }}>
      {payload[0].name}: <strong>{payload[0].value}</strong>
    </div>
  )
}

function InflowOutflowChart({ inflow, outflow }) {
  const data = [
    { name: 'Exchange Inflow',  count: inflow,  fill: '#ef4444' },
    { name: 'Exchange Outflow', count: outflow, fill: '#10b981' },
  ]
  return (
    <div>
      <div className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: OCEAN.muted }}>
        Inflow vs Outflow
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: OCEAN.textDim, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: OCEAN.text, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<InflowOutflowTooltip />} cursor={{ fill: '#ffffff08' }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TransactionTable({ transactions }) {
  if (!transactions?.length) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: OCEAN.muted }}>
        No large transactions found. On-chain data may require API key configuration.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: `1px solid ${OCEAN.border}` }}>
            {['Tx Hash', 'Amount USD', 'Crypto', 'Direction', 'Chain', 'Time'].map(h => (
              <th key={h} className="text-left pb-2 pr-4 font-semibold uppercase tracking-wider"
                style={{ color: OCEAN.muted }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, i) => {
            const dir = DIRECTION_CONFIG[tx.direction] ?? DIRECTION_CONFIG['Whale Transfer']
            return (
              <tr
                key={i}
                style={{ borderBottom: `1px solid ${OCEAN.bg}` }}
                className="hover:bg-[#0a1628] transition-colors"
              >
                <td className="py-2.5 pr-4 font-mono" style={{ color: OCEAN.textDim }}>
                  {shortHash(tx.hash)}
                </td>
                <td className="py-2.5 pr-4 font-mono font-semibold" style={{ color: OCEAN.text }}>
                  {fmtUsd(tx.amount_usd)}
                </td>
                <td className="py-2.5 pr-4 font-mono" style={{ color: OCEAN.muted }}>
                  {tx.amount_crypto != null
                    ? Number(tx.amount_crypto).toLocaleString(undefined, { maximumFractionDigits: 4 })
                    : '—'}
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold tracking-wide"
                    style={{ background: dir.bg, color: dir.color, border: `1px solid ${dir.color}33` }}
                  >
                    {dir.label}
                  </span>
                  {tx.exchange_name && (
                    <span className="ml-1.5 text-xs" style={{ color: OCEAN.muted }}>
                      {tx.exchange_name}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-4 font-mono" style={{ color: OCEAN.muted }}>
                  {tx.chain ?? '—'}
                </td>
                <td className="py-2.5 font-mono" style={{ color: OCEAN.muted }}>
                  {fmtTime(tx.timestamp)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function WhaleSection({ whales, whaleAnalysis }) {
  if (!whales) return null

  const {
    ticker,
    whale_sentiment,
    whale_sentiment_label,
    large_transactions = [],
    exchange_inflow_count  = 0,
    exchange_outflow_count = 0,
    inflow_outflow_ratio,
    whale_summary,
    top_holders_concentration,
    holders_note,
    chain_note,
    disclaimer,
  } = whales

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: OCEAN.bg,
        border: `1px solid ${OCEAN.border}`,
        boxShadow: `0 0 40px rgba(13,148,136,0.08), 0 0 1px ${OCEAN.borderGlow}`,
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{
          borderBottom: `1px solid ${OCEAN.border}`,
          background: `linear-gradient(90deg, #020d1a 0%, #031a2e 100%)`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{
              background: `linear-gradient(135deg, ${OCEAN.teal}33, ${OCEAN.cyan}22)`,
              border: `1px solid ${OCEAN.teal}55`,
            }}
          >
            🐋
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wide" style={{ color: OCEAN.text }}>
              Whale & Smart Money Activity
            </h3>
            <p className="text-xs mt-0.5" style={{ color: OCEAN.textDim }}>
              {ticker} · Large transactions ≥ $500k USD
            </p>
          </div>
        </div>

        <SentimentBadge label={whale_sentiment} sentiment={whale_sentiment_label} />
      </div>

      <div className="p-6 space-y-6">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Large Txs',     value: large_transactions.length },
            { label: 'Exchange Inflows',  value: exchange_inflow_count,  color: '#ef4444' },
            { label: 'Exchange Outflows', value: exchange_outflow_count, color: '#10b981' },
            {
              label: 'Inflow/Outflow Ratio',
              value: inflow_outflow_ratio != null ? `${inflow_outflow_ratio}x` : '—',
              color: inflow_outflow_ratio > 1 ? '#ef4444' : '#10b981',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-3"
              style={{ background: OCEAN.bgCard, border: `1px solid ${OCEAN.border}` }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: OCEAN.muted }}>
                {label}
              </div>
              <div className="text-xl font-mono font-bold" style={{ color: color ?? OCEAN.text }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Chart + holders row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg p-4"
            style={{ background: OCEAN.bgCard, border: `1px solid ${OCEAN.border}` }}>
            <InflowOutflowChart inflow={exchange_inflow_count} outflow={exchange_outflow_count} />
          </div>

          {/* Top holders */}
          <div className="rounded-lg p-4 flex flex-col justify-between"
            style={{ background: OCEAN.bgCard, border: `1px solid ${OCEAN.border}` }}>
            <div className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: OCEAN.muted }}>
              Supply Concentration
            </div>
            {top_holders_concentration != null ? (
              <>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-4xl font-mono font-bold" style={{ color: OCEAN.cyan }}>
                    {top_holders_concentration}%
                  </span>
                  <span className="text-sm mb-1" style={{ color: OCEAN.muted }}>not in circulation</span>
                </div>
                <div className="w-full h-2 rounded-full mb-3" style={{ background: OCEAN.deepBlue }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, top_holders_concentration)}%`,
                      background: `linear-gradient(90deg, ${OCEAN.teal}, ${OCEAN.cyan})`,
                      boxShadow: `0 0 8px ${OCEAN.cyan}55`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="text-2xl font-mono font-bold mb-2" style={{ color: OCEAN.muted }}>—</div>
            )}
            <p className="text-xs leading-relaxed" style={{ color: OCEAN.textDim }}>
              {holders_note ?? 'Supply concentration data unavailable.'}
            </p>
          </div>
        </div>

        {/* ── Transaction table ── */}
        <div>
          <div className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: OCEAN.muted }}>
            Recent Large Transactions
          </div>
          <div className="rounded-lg overflow-hidden"
            style={{ background: OCEAN.bgCard, border: `1px solid ${OCEAN.border}` }}>
            <div className="p-4">
              <TransactionTable transactions={large_transactions} />
            </div>
          </div>
        </div>

        {/* ── Whale summary ── */}
        {whale_summary && (
          <div className="rounded-lg p-4"
            style={{ background: OCEAN.bgCard, border: `1px solid ${OCEAN.border}` }}>
            <div className="text-xs uppercase tracking-widest mb-2 font-semibold" style={{ color: OCEAN.muted }}>
              Whale Behaviour Summary
            </div>
            <p className="text-sm leading-relaxed" style={{ color: OCEAN.text }}>
              {whale_summary}
            </p>
          </div>
        )}

        {/* ── AI whale analysis ── */}
        {whaleAnalysis && (
          <div
            className="rounded-lg p-4"
            style={{
              background: `linear-gradient(135deg, #031a2e 0%, #020d1a 100%)`,
              border: `1px solid ${OCEAN.teal}44`,
              boxShadow: `0 0 20px ${OCEAN.teal}0d`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-xs"
                style={{ background: `${OCEAN.teal}33`, border: `1px solid ${OCEAN.teal}55` }}
              >
                AI
              </div>
              <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: OCEAN.teal }}>
                AI Whale vs Technicals Analysis
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: OCEAN.text }}>
              {whaleAnalysis}
            </p>
          </div>
        )}

        {/* ── Footer notes ── */}
        <div className="flex flex-col gap-1">
          {chain_note && (
            <p className="text-xs" style={{ color: OCEAN.textDim }}>📡 {chain_note}</p>
          )}
          {disclaimer && (
            <p className="text-xs" style={{ color: OCEAN.textDim }}>⚠ {disclaimer}</p>
          )}
        </div>
      </div>
    </div>
  )
}
