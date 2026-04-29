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

function AccordionSection({ title, color, dotColor, count, children }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg"
        style={{
          background: hovered ? '#1e2d45' : '#0f1a2e',
          border: `1px solid ${open ? color + '55' : '#1e2d45'}`,
          cursor: 'pointer',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
          <span className="text-xs font-bold tracking-widest" style={{ color }}>{title}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: color + '22', color }}>{count}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: '#94a3b8' }}>{open ? 'hide' : 'show'}</span>
          <ChevronDown size={14} style={{ color: '#94a3b8', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
        </div>
      </button>
      {open && <ul className="space-y-0 mt-1">{children}</ul>}
    </div>
  )
}

export default function OpportunitiesRisks({ analysis }) {
  if (!analysis) return null
  const { key_opportunities = [], key_risks = [] } = analysis

  return (
    <div className="rounded-xl h-full flex flex-col" style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      <div className="p-4 pb-3">
        <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#94a3b8' }}>
          Opportunities &amp; Risks
        </h3>
      </div>

      <div className="px-4 pb-3 flex-1">
        <AccordionSection title="KEY OPPORTUNITIES" color="#10b981" dotColor="#34d399" count={key_opportunities.length}>
          {key_opportunities.map((opp, i) => (
            <Item key={i} text={opp} type="opportunity" />
          ))}
        </AccordionSection>
      </div>

      <div className="mx-4 h-px" style={{ background: '#1e3a5f' }} />

      <div className="px-4 py-3">
        <AccordionSection title="KEY RISKS" color="#ef4444" dotColor="#f87171" count={key_risks.length}>
          {key_risks.map((risk, i) => (
            <Item key={i} text={risk} type="risk" />
          ))}
        </AccordionSection>
      </div>
    </div>
  )
}
