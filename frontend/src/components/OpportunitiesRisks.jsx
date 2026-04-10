import { CheckCircle, AlertTriangle } from 'lucide-react'

function Item({ text, type }) {
  const isOpp = type === 'opportunity'
  return (
    <li className="flex items-start gap-2.5 py-2" style={{ borderBottom: '1px solid #1e2d45' }}>
      <span className="shrink-0 mt-0.5">
        {isOpp
          ? <CheckCircle size={14} className="text-emerald-400" />
          : <AlertTriangle size={14} className="text-red-400" />}
      </span>
      <span className="text-sm leading-snug" style={{ color: '#cbd5e1' }}>{text}</span>
    </li>
  )
}

export default function OpportunitiesRisks({ analysis }) {
  if (!analysis) return null
  const { key_opportunities = [], key_risks = [] } = analysis

  return (
    <div className="rounded-xl h-full flex flex-col" style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      <div className="p-4 pb-0">
        <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#475569' }}>
          Opportunities &amp; Risks
        </h3>
      </div>

      {/* Opportunities */}
      <div className="p-4 pb-2 flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold" style={{ color: '#10b981' }}>KEY OPPORTUNITIES</span>
        </div>
        <ul className="space-y-0">
          {key_opportunities.map((opp, i) => (
            <Item key={i} text={opp} type="opportunity" />
          ))}
        </ul>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px" style={{ background: '#1e3a5f' }} />

      {/* Risks */}
      <div className="p-4 pt-2">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>KEY RISKS</span>
        </div>
        <ul className="space-y-0">
          {key_risks.map((risk, i) => (
            <Item key={i} text={risk} type="risk" />
          ))}
        </ul>
      </div>
    </div>
  )
}
