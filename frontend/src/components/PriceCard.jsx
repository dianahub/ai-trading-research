import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendingUp, TrendingDown, Clock } from 'lucide-react'

function fmt(n, decimals = 2) {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#0a0e1a', border: '1px solid #1e2d45' }}>
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: '#475569' }}>{label}</div>
      <div className="text-sm font-mono font-semibold" style={{ color: '#e2e8f0' }}>{value}</div>
    </div>
  )
}

const SparkTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded px-2 py-1 text-xs font-mono"
      style={{ background: '#1e2d45', color: '#e2e8f0' }}>
      {fmt(payload[0].value)}
    </div>
  )
}

export default function PriceCard({ price }) {
  if (!price) return null

  if (price._unavailable) {
    return (
      <div className="rounded-xl h-full flex items-center justify-center p-6"
        style={{ background: '#111827', border: '1px solid #1e2d45' }}>
        <div className="text-center">
          <div className="text-2xl mb-2" style={{ color: '#f59e0b' }}>⚠</div>
          <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>
            Price data temporarily unavailable
          </p>
          <p className="text-xs mt-1" style={{ color: '#475569' }}>
            CoinGecko rate limit reached — retrying automatically
          </p>
        </div>
      </div>
    )
  }

  const changePct = price.change_24h_pct ?? price.change_pct ?? 0
  const isPositive = changePct >= 0
  const color = isPositive ? '#10b981' : '#ef4444'
  const sparkData = (price.sparkline_7d ?? []).map((p, i) => ({ i, price: p }))

  return (
    <div className="rounded-xl h-full" style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: '#1e2d45', color: '#06b6d4' }}>
                {price.ticker}
              </span>
              <span className="text-xs" style={{ color: '#475569' }}>{price.name}</span>
            </div>
            <div className="text-4xl font-mono font-bold tracking-tight" style={{ color: '#f1f5f9' }}>
              {fmt(price.price_usd)}
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold`}
            style={{ background: isPositive ? '#052e16' : '#1f0a0a', color }}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isPositive ? '+' : ''}{changePct.toFixed(2)}%
          </div>
        </div>

        {/* Sparkline */}
        {sparkData.length > 0 && (
          <div className="mb-4 -mx-1">
            <ResponsiveContainer width="100%" height={72}>
              <AreaChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <defs>
                  <linearGradient id={`spark-${price.ticker}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#spark-${price.ticker})`}
                  dot={false}
                  isAnimationActive={true}
                />
                <Tooltip content={<SparkTooltip />} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-between text-xs mt-0.5 px-1" style={{ color: '#475569' }}>
              <span>7 days ago</span>
              <span>Now</span>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatBox label="Market Cap" value={fmt(price.market_cap_usd)} />
          <StatBox label="24h Volume" value={fmt(price.volume_24h_usd)} />
        </div>

        {/* Timestamp */}
        {price.last_updated && (
          <div className="flex items-center gap-1.5 mt-3 text-xs" style={{ color: '#475569' }}>
            <Clock size={11} />
            Updated {new Date(price.last_updated).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  )
}
