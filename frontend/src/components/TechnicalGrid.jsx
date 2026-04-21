function Card({ title, children }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      <div className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: '#94a3b8' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Interpretation({ text }) {
  return (
    <p className="text-xs mt-2 leading-relaxed" style={{ color: '#94a3b8' }}>{text}</p>
  )
}

// RSI arc / gauge
function RsiGauge({ value }) {
  const clamped = Math.min(100, Math.max(0, value ?? 50))
  const color = clamped >= 70 ? '#ef4444' : clamped <= 30 ? '#10b981' : '#06b6d4'
  const label = clamped >= 70 ? 'OVERBOUGHT' : clamped <= 30 ? 'OVERSOLD' : 'NEUTRAL'

  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <span className="text-2xl font-mono font-bold" style={{ color }}>
          {clamped.toFixed(1)}
        </span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded"
          style={{ background: `${color}22`, color }}>
          {label}
        </span>
      </div>
      <div className="relative w-full h-3 rounded-full overflow-hidden" style={{ background: '#1e2d45' }}>
        {/* zone markers */}
        <div className="absolute inset-y-0 left-0 w-[30%] opacity-20 rounded-l-full"
          style={{ background: '#10b981' }} />
        <div className="absolute inset-y-0 right-0 w-[30%] opacity-20 rounded-r-full"
          style={{ background: '#ef4444' }} />
        {/* needle */}
        <div
          className="absolute top-0 h-full w-1 rounded-full -translate-x-1/2 transition-all duration-700"
          style={{ left: `${clamped}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-1" style={{ color: '#94a3b8' }}>
        <span>0</span><span>30</span><span>70</span><span>100</span>
      </div>
    </div>
  )
}

function MacdCard({ data }) {
  const { macd, signal, histogram, interpretation } = data ?? {}
  const histColor = histogram >= 0 ? '#10b981' : '#ef4444'

  return (
    <Card title="MACD (12, 26, 9)">
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[
          { label: 'MACD', value: macd },
          { label: 'Signal', value: signal },
          { label: 'Histogram', value: histogram, color: histColor },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center rounded-lg p-2" style={{ background: '#0a0e1a' }}>
            <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>{label}</div>
            <div className="text-sm font-mono font-bold" style={{ color: color ?? '#94a3b8' }}>
              {value != null ? value.toFixed(2) : '—'}
            </div>
          </div>
        ))}
      </div>
      {/* Mini histogram bar */}
      {histogram != null && (
        <div className="flex items-center gap-2">
          <div className="text-xs" style={{ color: '#94a3b8' }}>Hist</div>
          <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1e2d45' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.abs(histogram) * 20)}%`,
                background: histColor,
                marginLeft: histogram < 0 ? 'auto' : 0,
              }} />
          </div>
        </div>
      )}
      <Interpretation text={interpretation} />
    </Card>
  )
}

function RsiCard({ data }) {
  return (
    <Card title="RSI (14)">
      <RsiGauge value={data?.value} />
      <Interpretation text={data?.interpretation} />
    </Card>
  )
}

function SmaCard({ data, currentPrice }) {
  const { sma20, sma50, interpretation } = data ?? {}

  const pricePct20 = sma20 ? (((currentPrice - sma20) / sma20) * 100).toFixed(2) : null
  const pricePct50 = sma50 ? (((currentPrice - sma50) / sma50) * 100).toFixed(2) : null

  const rowColor = (pct) => pct == null ? '#94a3b8' : pct >= 0 ? '#10b981' : '#ef4444'

  return (
    <Card title="Moving Averages">
      <div className="space-y-2">
        {[
          { label: 'SMA 20', value: sma20, pct: pricePct20 },
          { label: 'SMA 50', value: sma50, pct: pricePct50 },
        ].map(({ label, value, pct }) => (
          <div key={label} className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: '#0a0e1a' }}>
            <span className="text-xs" style={{ color: '#94a3b8' }}>{label}</span>
            <span className="text-sm font-mono" style={{ color: '#e2e8f0' }}>
              {value != null ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </span>
            {pct != null && (
              <span className="text-xs font-mono font-semibold"
                style={{ color: rowColor(pct) }}>
                {pct >= 0 ? '+' : ''}{pct}%
              </span>
            )}
          </div>
        ))}
      </div>
      <Interpretation text={interpretation} />
    </Card>
  )
}

function BollingerCard({ data, currentPrice }) {
  const { upper, middle, lower, interpretation } = data ?? {}

  const position = upper && lower
    ? Math.max(0, Math.min(100, ((currentPrice - lower) / (upper - lower)) * 100))
    : 50

  const fmt = v => v != null
    ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'

  return (
    <Card title="Bollinger Bands (20, 2)">
      <div className="space-y-2 mb-2">
        {[
          { label: 'Upper', value: upper, color: '#ef444466' },
          { label: 'Middle', value: middle, color: '#06b6d466' },
          { label: 'Lower', value: lower, color: '#10b98166' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between text-xs items-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span style={{ color: '#94a3b8' }}>{label}</span>
            </div>
            <span className="font-mono" style={{ color: '#94a3b8' }}>{fmt(value)}</span>
          </div>
        ))}
      </div>
      {/* Price position within bands */}
      {upper && lower && (
        <div className="mt-3">
          <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Price position in bands</div>
          <div className="relative h-2 rounded-full" style={{ background: '#1e2d45' }}>
            <div className="absolute inset-y-0 left-0 right-0 rounded-full opacity-20"
              style={{ background: 'linear-gradient(90deg, #10b981, #06b6d4, #ef4444)' }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all duration-700"
              style={{ left: `${position}%`, background: '#06b6d4', borderColor: '#0a0e1a' }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1" style={{ color: '#94a3b8' }}>
            <span>Lower</span><span>Middle</span><span>Upper</span>
          </div>
        </div>
      )}
      <Interpretation text={interpretation} />
    </Card>
  )
}

function VolumeCard({ data }) {
  const { current, avg_30d, ratio_vs_avg, interpretation } = data ?? {}
  const ratio = ratio_vs_avg ?? 1
  const color = ratio >= 1.5 ? '#10b981' : ratio <= 0.5 ? '#ef4444' : '#f59e0b'

  const fmtVol = v => {
    if (v == null) return '—'
    if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`
    if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`
    return `$${v.toLocaleString()}`
  }

  return (
    <Card title="Volume Analysis">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-xs mb-0.5" style={{ color: '#94a3b8' }}>Current Volume</div>
          <div className="text-lg font-mono font-bold" style={{ color: '#e2e8f0' }}>
            {fmtVol(current)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs mb-0.5" style={{ color: '#94a3b8' }}>vs 30d Avg</div>
          <div className="text-2xl font-mono font-bold" style={{ color }}>
            {ratio.toFixed(2)}x
          </div>
        </div>
      </div>
      <div className="w-full h-2 rounded-full mb-1" style={{ background: '#1e2d45' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, ratio * 50)}%`,
            background: color,
            boxShadow: `0 0 6px ${color}66`,
          }}
        />
      </div>
      <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>
        30d avg: {fmtVol(avg_30d)}
      </div>
      <Interpretation text={interpretation} />
    </Card>
  )
}

export default function TechnicalGrid({ technicals }) {
  if (!technicals) return null

  if (technicals._unavailable) {
    return (
      <div>
        <h3 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#94a3b8' }}>
          Technical Indicators
        </h3>
        <div className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: '#111827', border: '1px solid #1e2d45' }}>
          <span style={{ color: '#f59e0b' }}>⚠</span>
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            Technical data temporarily unavailable
          </p>
        </div>
      </div>
    )
  }

  const ind = technicals.indicators ?? {}
  const price = technicals.current_price

  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#94a3b8' }}>
        Technical Indicators
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MacdCard data={ind.macd} />
        <RsiCard data={ind.rsi} />
        <SmaCard data={ind.sma} currentPrice={price} />
        <BollingerCard data={ind.bollinger_bands} currentPrice={price} />
        <VolumeCard data={ind.volume} />
      </div>
    </div>
  )
}
