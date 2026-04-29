import { useState } from 'react'
import { CheckCircle, AlertTriangle, ChevronDown } from 'lucide-react'

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

function AccordionSection({ title, color, dotColor, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
          <span className="text-xs font-semibold" style={{ color }}>{title}</span>
        </div>
        <ChevronDown size={14} style={{ color: '#94a3b8', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
      </button>
      {open && <ul className="space-y-0">{children}</ul>}
    </div>
  )
}

export default function OpportunitiesRisks({ analysis }) {
  if (!analysis) return null
  const { key_opportunities = [], key_risks = [] } = analysis

  return (
    <div className="rounded-xl h-full flex flex-col" style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      <div className="p-4 pb-0">
        <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#94a3b8' }}>
          Opportunities &amp; Risks
        </h3>
      </div>

      <div className="p-4 pb-2 flex-1">
        <AccordionSection title="KEY OPPORTUNITIES" color="#10b981" dotColor="#34d399" defaultOpen={true}>
          {key_opportunities.map((opp, i) => (
            <Item key={i} text={opp} type="opportunity" />
          ))}
        </AccordionSection>
      </div>

      <div className="mx-4 h-px" style={{ background: '#1e3a5f' }} />

      <div className="p-4 pt-2">
        <AccordionSection title="KEY RISKS" color="#ef4444" dotColor="#f87171" defaultOpen={true}>
          {key_risks.map((risk, i) => (
            <Item key={i} text={risk} type="risk" />
          ))}
        </AccordionSection>
      </div>
    </div>
  )
}
