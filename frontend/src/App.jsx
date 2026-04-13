import { useState, useEffect } from 'react'
import './App.css'
import SearchBar from './components/SearchBar'
import PriceCard from './components/PriceCard'
import SentimentBanner from './components/SentimentBanner'
import TechnicalGrid from './components/TechnicalGrid'
import SupportResistance from './components/SupportResistance'
import OpportunitiesRisks from './components/OpportunitiesRisks'
import AnalysisCards from './components/AnalysisCards'
import NewsSection from './components/NewsSection'
import ResearchSummary from './components/ResearchSummary'
import WhaleSection from './components/WhaleSection'
import AstroInsightsPanel from './components/AstroInsightsPanel'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts)
  const json = await res.json()
  if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`)
  return json
}

export default function App() {
  const [loading, setLoading]     = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError]         = useState(null)
  const [data, setData]           = useState(null)
  const [astroData, setAstroData] = useState(null)
  const [showAstro, setShowAstro] = useState(() => {
    try { return localStorage.getItem('showAstro') !== 'false' } catch { return true }
  })

  // Fetch astro data once on mount — independent of ticker searches
  useEffect(() => {
    apiFetch('/astro')
      .then(setAstroData)
      .catch(() => null) // silent failure
  }, [])

  const handleToggleAstro = () => {
    setShowAstro(prev => {
      const next = !prev
      try { localStorage.setItem('showAstro', String(next)) } catch { /* storage unavailable */ }
      return next
    })
  }

  const handleSearch = async (ticker) => {
    setLoading(true)
    setAnalyzing(false)
    setError(null)
    setData(null)

    try {
      const [price, news, technicals, whales] = await Promise.all([
        apiFetch(`/price/${ticker}`),
        apiFetch(`/news/${ticker}`),
        apiFetch(`/technicals/${ticker}`),
        apiFetch(`/whales/${ticker}`),
      ])

      setData({ price, news, technicals, whales, analysis: null })
      setLoading(false)
      setAnalyzing(true)

      const analysis = await apiFetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          price_data: price,
          headlines: news.articles?.map(a => a.title) ?? [],
          technical_data: technicals,
          whale_data: whales,
          astro_signal: astroData?.astro_signal ?? null,
        }),
      })

      setData(prev => ({ ...prev, analysis }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0e1a' }}>
      {/* Header */}
      <header style={{ background: '#0a0e1a', borderBottom: '1px solid #1e2d45' }}
        className="sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div>
              <div className="text-sm font-bold tracking-widest text-white uppercase">
                AI Market Research
              </div>
              <div className="text-xs" style={{ color: '#475569' }}>
                Stocks &amp; Crypto Analysis
              </div>
            </div>
          </div>
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs shrink-0"
            style={{ color: '#475569' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block pulse-glow" />
            LIVE
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Astro panel — only shown after a ticker has been searched */}
        {astroData && data && (
          <div className="fade-in">
            <AstroInsightsPanel
              astroData={astroData}
              visible={showAstro}
              onToggle={handleToggleAstro}
            />
          </div>
        )}

        {/* Idle state */}
        {!loading && !data && !error && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 fade-in">
            <div className="text-6xl mb-2">📊</div>
            <h2 className="text-2xl font-semibold" style={{ color: '#94a3b8' }}>
              Enter a ticker to begin
            </h2>
            <p style={{ color: '#475569' }} className="text-sm">
              Try BTC, ETH, AAPL, TSLA, NVDA — powered by CoinGecko, Finnhub &amp; Claude AI
            </p>
            <div className="flex gap-2 mt-4">
              {['BTC', 'ETH', 'SOL', 'DOGE', 'ADA'].map(t => (
                <button key={t} onClick={() => handleSearch(t)}
                  className="px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all hover:scale-105 cursor-pointer"
                  style={{ background: '#111827', border: '1px solid #1e2d45', color: '#94a3b8' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-5 fade-in">
            <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: '#0f1a2e', border: '1px solid #1e3a5f' }}>
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-sm" style={{ color: '#94a3b8' }}>
                Fetching price, technicals, news and whale data — please wait…
              </span>
            </div>
            <div className="h-24 rounded-xl animate-pulse" style={{ background: '#111827' }} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 rounded-xl animate-pulse" style={{ background: '#111827' }} />
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: '#111827' }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl p-5 fade-in flex items-start gap-3"
            style={{ background: '#1a0f0f', border: '1px solid #7f1d1d' }}>
            <span className="text-red-400 text-xl">⚠</span>
            <div>
              <p className="text-red-400 font-medium">Error fetching data</p>
              <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Data panels */}
        {data && (
          <>
            {/* Sentiment banner — only once analysis is ready */}
            {data.analysis && (
              <div className="fade-in">
                <SentimentBanner analysis={data.analysis} ticker={data.price?.ticker} />
              </div>
            )}

            {/* Analyzing indicator */}
            {analyzing && !data.analysis && (
              <div className="rounded-xl p-4 flex items-center gap-3 fade-in"
                style={{ background: '#0f1a2e', border: '1px solid #1e3a5f' }}>
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm" style={{ color: '#94a3b8' }}>
                  Claude AI is analyzing price data, technicals, news and astrological signals — please wait…
                </span>
              </div>
            )}

            {/* Research summary — shown first once analysis is ready */}
            {data.analysis && (
              <div className="fade-in">
                <ResearchSummary analysis={data.analysis} ticker={data.price?.ticker} />
              </div>
            )}

            {/* Price + summary row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 fade-in">
              <div className="lg:col-span-2">
                <PriceCard price={data.price} />
              </div>
              {data.analysis && (
                <div className="fade-in">
                  <OpportunitiesRisks analysis={data.analysis} />
                </div>
              )}
            </div>

            {/* Technical indicators grid */}
            <div className="fade-in">
              <TechnicalGrid technicals={data.technicals} />
            </div>

            {/* Support / Resistance */}
            <div className="fade-in">
              <SupportResistance technicals={data.technicals} price={data.price} />
            </div>

            {/* Analysis cards (needs AI) */}
            {data.analysis && (
              <div className="fade-in">
                <AnalysisCards analysis={data.analysis} />
              </div>
            )}

            {/* Whale activity */}
            {data.whales && (
              <div className="fade-in">
                <WhaleSection
                  whales={data.whales}
                  whaleAnalysis={data.analysis?.whale_sentiment_analysis}
                />
              </div>
            )}

            {/* News */}
            <div className="fade-in">
              <NewsSection news={data.news} newsSentiment={data.analysis?.news_sentiment} />
            </div>

          </>
        )}
      </main>

      {/* Disclaimer footer */}
      <footer className="mt-12 px-6 py-6 text-center"
        style={{ borderTop: '1px solid #1e2d45' }}>
        <p className="text-xs" style={{ color: '#475569' }}>
          ⚠ This platform provides educational research only. Not financial advice.
          Cryptocurrency investments carry significant risk. Always conduct your own research.
          Past performance does not guarantee future results.
        </p>
      </footer>
    </div>
  )
}
