import { useState, useEffect } from 'react'
import { BarChart2, Activity, TrendingUp, ChevronDown, Cpu, PieChart } from 'lucide-react'

function AnalysisCard({ icon: Icon, title, accentColor, children }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: '#0a0e1a', border: '1px solid #1e2d45' }}>
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
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#ai-analysis') setOpen(true)
    }
    const handleOpen = (e) => { if (e.detail === '#ai-analysis') setOpen(true) }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    window.addEventListener('open-section', handleOpen)
    return () => {
      window.removeEventListener('hashchange', handleHash)
      window.removeEventListener('open-section', handleOpen)
    }
  }, [])

  if (!analysis) return null

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#111827', border: '1px solid #38bdf8' }}>
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: open ? '1px solid #38bdf844' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#38bdf822' }}>
            <Cpu size={14} style={{ color: '#38bdf8' }} />
          </div>
          <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: '#e2e8f0' }}>
            AI Analysis of the Technicals
          </h3>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold flex-shrink-0"
          style={{
            background: open ? '#1e3a5f' : '#0f1a2e',
            border: '1px solid #1e3a5f',
            cursor: 'pointer',
            color: '#e2e8f0',
            fontSize: 13,
            letterSpacing: '0.05em',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1e3a5f'}
          onMouseLeave={e => { if (!open) e.currentTarget.style.background = '#0f1a2e' }}
        >
          <span>{open ? 'HIDE' : 'SHOW'}</span>
          <ChevronDown
            size={15}
            style={{
              color: '#06b6d4',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      </div>

      {open && (
        <div className="p-5 space-y-4">
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
            <div className="rounded-xl p-5"
              style={{ background: '#0a0e1a', border: '1px solid #1e2d45' }}>
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

          {analysis.fundamentals_analysis && (
            <div className="rounded-xl p-5"
              style={{ background: '#0a0e1a', border: '1px solid #1e2d45' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: '#8b5cf622' }}>
                  <PieChart size={14} style={{ color: '#8b5cf6' }} />
                </div>
                <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#94a3b8' }}>
                  Fundamentals Analysis
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                {analysis.fundamentals_analysis}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
