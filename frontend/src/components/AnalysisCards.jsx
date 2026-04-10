import { BarChart2, Activity, TrendingUp } from 'lucide-react'

function AnalysisCard({ icon: Icon, title, accentColor, children }) { // eslint-disable-line no-unused-vars
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accentColor}22` }}>
          <Icon size={14} style={{ color: accentColor }} />
        </div>
        <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#475569' }}>
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

  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#475569' }}>
        AI Analysis
      </h3>
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

      {/* Support / resistance analysis */}
      {analysis.support_resistance_analysis && (
        <div className="mt-4 rounded-xl p-5"
          style={{ background: '#111827', border: '1px solid #1e2d45' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: '#10b98122' }}>
              <TrendingUp size={14} style={{ color: '#10b981' }} />
            </div>
            <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#475569' }}>
              Support &amp; Resistance Analysis
            </h3>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
            {analysis.support_resistance_analysis}
          </p>
        </div>
      )}
    </div>
  )
}
