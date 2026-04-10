import { FileText, Shield } from 'lucide-react'

export default function ResearchSummary({ analysis, ticker }) {
  if (!analysis) return null
  const paragraphs = (analysis.research_summary ?? '').split('\n\n').filter(Boolean)

  return (
    <div className="rounded-xl" style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: '1px solid #1e2d45' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: '#06b6d422' }}>
          <FileText size={14} style={{ color: '#06b6d4' }} />
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#475569' }}>
            {ticker} · Full Research Summary
          </h3>
          <p className="text-xs mt-0.5" style={{ color: '#2a3f5f' }}>
            AI-generated analysis · Educational purposes only
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-4">
        {paragraphs.map((para, i) => (
          <div key={i} className="flex gap-4">
            <div className="w-1 rounded-full shrink-0"
              style={{
                background: i === 0
                  ? 'linear-gradient(180deg, #06b6d4, #3b82f6)'
                  : i === 1
                    ? 'linear-gradient(180deg, #8b5cf6, #06b6d4)'
                    : 'linear-gradient(180deg, #10b981, #8b5cf6)',
              }}
            />
            <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
              {para}
            </p>
          </div>
        ))}
      </div>

      {/* Disclaimer strip */}
      <div className="flex items-center gap-2 px-6 py-3 rounded-b-xl"
        style={{ background: '#0a0e1a', borderTop: '1px solid #1e2d45' }}>
        <Shield size={13} style={{ color: '#475569' }} />
        <p className="text-xs" style={{ color: '#475569' }}>
          {analysis.disclaimer}
        </p>
      </div>
    </div>
  )
}
