import { useState } from 'react'
import { FileText, Shield, ChevronDown } from 'lucide-react'

export default function ResearchSummary({ analysis, ticker }) {
  if (!analysis) return null
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const paragraphs = (analysis.research_summary ?? '').split('\n\n').filter(Boolean)

  return (
    <div className="rounded-xl" style={{ background: '#111827', border: '1px solid #1e2d45' }}>
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#06b6d422' }}>
            <FileText size={14} style={{ color: '#06b6d4' }} />
          </div>
          <h3 className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#94a3b8' }}>
            {ticker} · AI Generated Full Research Summary
          </h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#f59e0b18', border: '1px solid #f59e0b55' }}>
          <span className="text-lg">⚠</span>
          <p className="text-sm font-bold" style={{ color: '#fbbf24' }}>
            AI-generated analysis — For educational purposes only. Not financial advice.
          </p>
        </div>
      </div>

      {/* Big centered show/hide button */}
      <div className="px-6 pb-4">
        <button
          onClick={() => setOpen(o => !o)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold"
          style={{
            background: hovered ? '#1e3a5f' : '#0f1a2e',
            border: '1px solid #1e3a5f',
            cursor: 'pointer',
            color: '#e2e8f0',
            fontSize: 15,
            transition: 'background 0.15s ease',
          }}
        >
          <span>{open ? 'Hide Summary' : 'Show Summary'}</span>
          <ChevronDown size={18} style={{ color: '#06b6d4', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
        </button>
      </div>

      {/* Body */}
      {open && (
        <>
          <div className="px-6 py-5 space-y-4" style={{ borderTop: '1px solid #1e2d45' }}>
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
            <Shield size={13} style={{ color: '#94a3b8' }} />
            <p className="text-xs" style={{ color: '#94a3b8' }}>
              {analysis.disclaimer}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
