import { useState } from 'react'

export default function ShareButton({ text, url, label = 'Share', size = 'sm' }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const fullUrl = url || window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ text, url: fullUrl })
        return
      } catch { /* user cancelled or not supported */ }
    }
    // Fallback: open X/Twitter compose
    const tweet = encodeURIComponent(`${text}\n${fullUrl}`)
    window.open(`https://twitter.com/intent/tweet?text=${tweet}`, '_blank', 'width=550,height=420')
  }

  const copyLink = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(url || window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard not available */ }
  }

  const isSmall = size === 'sm'

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={share}
        title="Share on X / Twitter"
        className="flex items-center gap-1.5 rounded-lg transition-all cursor-pointer hover:brightness-125"
        style={{
          background: '#111827',
          border: '1px solid #1e2d45',
          color: '#94a3b8',
          padding: isSmall ? '4px 10px' : '6px 14px',
          fontSize: isSmall ? '11px' : '13px',
          fontWeight: 600,
        }}
      >
        {/* X logo */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        {copied ? 'Copied!' : label}
      </button>
      <button
        onClick={copyLink}
        title="Copy link"
        className="flex items-center justify-center rounded-lg transition-all cursor-pointer hover:brightness-125"
        style={{
          background: '#111827',
          border: '1px solid #1e2d45',
          color: copied ? '#10b981' : '#64748b',
          padding: isSmall ? '4px 7px' : '6px 9px',
        }}
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        )}
      </button>
    </div>
  )
}
