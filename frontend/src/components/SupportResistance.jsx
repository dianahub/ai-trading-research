function fmt(v) {
  if (v == null) return '—'
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SupportResistance({ technicals, price }) {
  if (!technicals) return null
  const sr = technicals.indicators?.support_resistance ?? {}
  const currentPrice = price?.price_usd ?? technicals.current_price

  const support = sr.support
  const resistance = sr.resistance

  // Position of current price between support and resistance (0–100%)
  const position = support != null && resistance != null && resistance !== support
    ? Math.max(0, Math.min(100, ((currentPrice - support) / (resistance - support)) * 100))
    : 50

  const distToSupport = support ? (((currentPrice - support) / support) * 100).toFixed(2) : null
  const distToResistance = resistance ? (((resistance - currentPrice) / currentPrice) * 100).toFixed(2) : null

  return (
    <div className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      <h3 className="text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: '#475569' }}>
        Support &amp; Resistance · 30-Day Range
      </h3>

      <div className="flex gap-6">
        {/* Labels column */}
        <div className="space-y-2 text-right w-28 shrink-0">
          <div className="py-1">
            <div className="text-xs" style={{ color: '#475569' }}>Resistance</div>
            <div className="text-sm font-mono font-bold" style={{ color: '#ef4444' }}>
              {fmt(resistance)}
            </div>
            {distToResistance != null && (
              <div className="text-xs" style={{ color: '#475569' }}>+{distToResistance}% away</div>
            )}
          </div>
          <div className="py-1">
            <div className="text-xs" style={{ color: '#475569' }}>Current</div>
            <div className="text-sm font-mono font-bold" style={{ color: '#06b6d4' }}>
              {fmt(currentPrice)}
            </div>
          </div>
          <div className="py-1">
            <div className="text-xs" style={{ color: '#475569' }}>Support</div>
            <div className="text-sm font-mono font-bold" style={{ color: '#10b981' }}>
              {fmt(support)}
            </div>
            {distToSupport != null && (
              <div className="text-xs" style={{ color: '#475569' }}>-{distToSupport}% below</div>
            )}
          </div>
        </div>

        {/* Visual channel */}
        <div className="flex-1 relative min-h-[120px]">
          {/* Background track */}
          <div className="absolute left-0 right-0 top-4 bottom-4 rounded-xl"
            style={{ background: '#0a0e1a', border: '1px solid #1e2d45' }}>
            {/* Gradient fill between levels */}
            <div className="absolute inset-x-0 top-0 bottom-[40%] rounded-t-xl opacity-15"
              style={{ background: 'linear-gradient(180deg, #ef4444 0%, transparent 100%)' }} />
            <div className="absolute inset-x-0 top-[60%] bottom-0 rounded-b-xl opacity-15"
              style={{ background: 'linear-gradient(180deg, transparent 0%, #10b981 100%)' }} />
          </div>

          {/* Resistance line */}
          <div className="absolute left-0 right-0 top-4 flex items-center gap-2 z-10">
            <div className="flex-1 h-px" style={{ background: '#ef4444', boxShadow: '0 0 6px #ef444488' }} />
            <span className="text-xs font-mono shrink-0" style={{ color: '#ef4444' }}>
              {fmt(resistance)}
            </span>
          </div>

          {/* Support line */}
          <div className="absolute left-0 right-0 bottom-4 flex items-center gap-2 z-10">
            <div className="flex-1 h-px" style={{ background: '#10b981', boxShadow: '0 0 6px #10b98188' }} />
            <span className="text-xs font-mono shrink-0" style={{ color: '#10b981' }}>
              {fmt(support)}
            </span>
          </div>

          {/* Current price marker */}
          {support != null && resistance != null && (
            <div
              className="absolute left-0 right-8 flex items-center gap-2 z-20 transition-all duration-700"
              style={{ top: `${4 + (1 - position / 100) * (100 - 8)}%` }}>
              <div className="flex-1 h-px border-t border-dashed" style={{ borderColor: '#06b6d4' }} />
              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background: '#06b6d4',
                  boxShadow: '0 0 8px #06b6d4',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Interpretation row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {sr.support_interpretation && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#0a1a0f', border: '1px solid #065f46', color: '#6ee7b7' }}>
            ↑ {sr.support_interpretation}
          </div>
        )}
        {sr.resistance_interpretation && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#1f0a0a', border: '1px solid #7f1d1d', color: '#fca5a5' }}>
            ↓ {sr.resistance_interpretation}
          </div>
        )}
      </div>
    </div>
  )
}
