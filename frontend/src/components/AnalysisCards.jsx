import { useState } from 'react'
import { BarChart2, Activity, TrendingUp, ChevronDown } from 'lucide-react'

function AnalysisCard({ icon: Icon, title, accentColor, children }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accentColor}22` }}>
          <Icon size={14} style={{ color: accentColor }} />
        </div>
        <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#94a3b8' }}>
          {title}
        </h3>
      </div>
      <div className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
        {children}
      </div>
    </div>
  )
}

function Paragraphs({ text }) {
  if (!text) return null
  return (
    <>
      {text.split('\n\n').map((para, i) => (
        <p key={i} className={i > 0 ? 'mt-3' : ''}>{para}</p>
      ))}
    </>
  )
}

export default function AnalysisCards({ analysis }) {
  if (!analysis) return null
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  return (
    <div>
      {/* Header row — title + show/hide button inline */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <h3 className="text-base uppercase tracking-wide font-bold" style={{ color: '#e2e8f0' }}>
          AI Analysis of the Technicals
        </h3>
        <button
          onClick={() => setOpen(o => !o)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold flex-shrink-0"
          style={{
            background: hovered ? '#1e3a5f' : '#0f1a2e',
            border: '1px solid #1e3a5f',
            cursor: 'pointer',
            color: '#e2e8f0',
            fontSize: 13,
            letterSpacing: '0.05em',
            transition: 'background 0.15s ease',
          }}
        >
          <span>{open ? 'HIDE' : 'SHOW'}</span>
          <ChevronDown size={15} style={{ color: '#06b6d4', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
        </button>
      </div>

      {open && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnalysisCard icon={Activity} title="Technical Summary" accentColor="#06b6d4">
              <Paragraphs text={analysis.technical_summary} />
            </AnalysisCard>

            <AnalysisCard icon={BarChart2} title="MACD Analysis" accentColor="#8b5cf6">
              <Paragraphs text={analysis.macd_analysis} />
            </AnalysisCard>

            <AnalysisCard icon={TrendingUp} title="Volume Analysis" accentColor="#f59e0b">
              <Paragraphs text={analysis.volume_analysis} />
            </AnalysisCard>
          </div>

          {analysis.support_resistance_analysis && (
            <div className="mt-4 rounded-xl p-5"
              style={{ background: '#111827', border: '1px solid #1e2d45' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: '#10b98122' }}>
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                </div>
                <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#94a3b8' }}>
                  Support &amp; Resistance Analysis
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                {analysis.support_resistance_analysis}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
