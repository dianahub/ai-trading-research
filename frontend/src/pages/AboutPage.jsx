import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const ASTRO_API = import.meta.env.VITE_ASTRO_URL ?? 'https://astro-api-production.up.railway.app'

const KNOWN_SOURCES = [
  { name: 'StockAstrologer',                    url: 'https://stockastrologer.com' },
  { name: 'Invest By Cycles Newsletter',        url: 'https://investbycyclesnewsletter.substack.com' },
  { name: "Rowan's Financial Astrology",        url: 'https://rowansfinancialastrology.com' },
  { name: 'AuraWright Media',                   url: 'https://aurawrightmedia.substack.com' },
  { name: 'LunaticTrader',                      url: 'https://blog.lunatictrader.com' },
  { name: 'Financial Astrology by Rajeev Prakash', url: 'https://rajeevprakash.com' },
  { name: 'The Weekly Stars',                   url: 'https://theweeklystars.substack.com' },
  { name: 'AKxyz Astrology',                    url: 'https://akxyz.blogspot.com' },
  { name: 'Astrodoc Anil',                      url: 'https://astrodocanil.com' },
  { name: 'Cosmologer',                         url: 'https://cosmologer.blogspot.com' },
]

function PageLayout({ title, children }) {
  return (
    <div style={{ background: '#070b16', minHeight: '100vh', color: '#e2e8f0' }}>
      <header style={{ background: '#0a0e1a', borderBottom: '1px solid #1e2d45' }}
        className="sticky top-0 z-50 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <span className="text-sm font-bold tracking-widest text-white">Starsignal.io</span>
          </Link>
          <Link to="/" className="text-xs hover:underline" style={{ color: '#64748b' }}>← Back to app</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-8" style={{ color: '#f1f5f9' }}>{title}</h1>
        <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
          {children}
        </div>
      </main>

      <footer className="mt-16 px-6 py-8" style={{ borderTop: '1px solid #1e2d45', background: '#0a0e1a' }}>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <span className="text-xs" style={{ color: '#475569' }}>© 2026 <a href="https://dianacastillo.zo.space/futurotek/" target="_blank" rel="noopener noreferrer" style={{ color: '#475569', textDecoration: 'underline' }}>Futurotek LLC</a>. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/about" className="text-xs hover:underline" style={{ color: '#64748b' }}>About</Link>
            <Link to="/terms" className="text-xs hover:underline" style={{ color: '#64748b' }}>Terms of Service</Link>
            <Link to="/privacy" className="text-xs hover:underline" style={{ color: '#64748b' }}>Privacy Policy</Link>
            <Link to="/contact" className="text-xs hover:underline" style={{ color: '#64748b' }}>Contact</Link>
            <a href="https://www.linkedin.com/company/113175994/" target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#64748b' }}>LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function AboutPage() {
  const [sources, setSources] = useState(KNOWN_SOURCES)

  useEffect(() => {
    fetch(`${ASTRO_API}/api/v1/sources`)
      .then(r => r.json())
      .then(d => { if (d.sources?.length) setSources(d.sources) })
      .catch(() => {})
  }, [])

  return (
    <PageLayout title="About Starsignal.io">

      <p>
        Starsignal.io is an AI-powered trading research platform that combines technical analysis,
        news sentiment, smart money tracking, and financial astrology into a single research dashboard.
        It is a product of <a href="https://dianacastillo.zo.space/futurotek/" target="_blank" rel="noopener noreferrer" style={{ color: '#a5b4fc' }}>Futurotek LLC</a>.
      </p>

      <p>
        Astrological market signals are sourced by continuously monitoring a curated set of
        independent financial astrology researchers. Their posts are parsed, summarized by Claude AI,
        and classified into structured signals covering outlook, confidence, timeframe, and topic.
      </p>

      {/* Astrologers section */}
      <div className="pt-4">
        <h2 className="text-base font-bold mb-5" style={{ color: '#e2e8f0' }}>
          ♅ Our Astrology Sources {sources.length > 0 && <span style={{ color: '#475569', fontWeight: 400 }}>({sources.length})</span>}
        </h2>
        <div className="space-y-4">
          {sources.map(a => (
            <div
              key={a.name}
              className="rounded-lg p-4 space-y-2"
              style={{ background: '#0f1a2e', border: '1px solid #1e3a5f' }}
            >
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold hover:underline"
                style={{ color: '#a5b4fc' }}
              >
                {a.name} ↗
              </a>
              <p className="text-xs font-mono" style={{ color: '#334155' }}>{a.url}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2" style={{ borderTop: '1px solid #1e2d45' }}>
        <p className="text-xs" style={{ color: '#475569' }}>
          Astrological insights are alternative data for informational purposes only and do not
          constitute investment advice. Always do your own research.
        </p>
      </div>
    </PageLayout>
  )
}
