import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function JoinPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [partner, setPartner] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) { navigate('/beta'); return }

    fetch(`${API}/join/${slug}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        setPartner(data)
        // Store referral in cookie for 30 days
        document.cookie = `ref_partner=${slug}; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Lax`
      })
      .catch(() => setNotFound(true))
  }, [slug, navigate])

  function handleCTA() {
    navigate(`/beta?ref=${slug}`)
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}>
        <div className="text-center px-4">
          <div className="text-5xl mb-4">🔭</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Link not found</h1>
          <p className="mb-6" style={{ color: '#94a3b8' }}>This referral link doesn't exist.</p>
          <button onClick={() => navigate('/beta')}
            className="px-6 py-3 rounded-lg font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>
            Apply for Beta Access
          </button>
        </div>
      </div>
    )
  }

  if (!partner) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}>
        <div className="text-center" style={{ color: '#94a3b8' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: '#060a14', color: '#e2e8f0' }}>

      <div className="w-full max-w-lg text-center">
        {/* Partner attribution */}
        <div className="mb-8 px-4 py-3 rounded-full inline-flex items-center gap-2 text-sm"
          style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8' }}>
          <span style={{ color: '#06b6d4' }}>✦</span>
          <span><strong style={{ color: '#e2e8f0' }}>{partner.name}</strong> thinks you'll love Star Signal</span>
        </div>

        {/* Logo / brand */}
        <div className="mb-4 text-4xl font-black tracking-tight" style={{ color: '#f1f5f9' }}>
          Star Signal
        </div>
        <div className="text-sm font-semibold uppercase tracking-widest mb-6" style={{ color: '#06b6d4' }}>
          AI-Powered Crypto Research
        </div>

        <h1 className="text-3xl font-black mb-4 leading-tight" style={{ color: '#f1f5f9' }}>
          Technical analysis, whale tracking, and AI insights — in one place.
        </h1>
        <p className="text-base mb-10 leading-relaxed" style={{ color: '#94a3b8' }}>
          Star Signal combines live price data, MACD/RSI/Bollinger Bands, whale transaction monitoring,
          news sentiment, and Claude AI to produce structured research reports on any crypto asset.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {['AI Research Reports', 'Whale Tracking', 'Technical Indicators', 'News Sentiment', 'Real-Time Data'].map(f => (
            <span key={f} className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8' }}>
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button onClick={handleCTA}
          className="w-full py-4 rounded-xl text-lg font-bold text-white mb-4 transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>
          Get 30 Days Free
        </button>
        <p className="text-sm mb-2" style={{ color: '#64748b' }}>
          Free for 30 days. No credit card required. $19/month after as a founding member.
        </p>
        <p className="text-xs" style={{ color: '#475569' }}>
          For informational purposes only. Not financial advice.
        </p>
      </div>
    </div>
  )
}
