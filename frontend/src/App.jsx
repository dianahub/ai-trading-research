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

// ETFs whose underlying asset is directly covered by astro API topics
const ETF_TOPIC_MAP = {
  // Gold ETFs
  GLD: 'gold', IAU: 'gold', SGOL: 'gold', GLDM: 'gold', BAR: 'gold',
  OUNZ: 'gold', PHYS: 'gold', AAAU: 'gold',
  // Gold miner ETFs
  GDX: 'gold', GDXJ: 'gold', RING: 'gold', GOAU: 'gold',
  // Gold mining stocks
  NEM: 'gold', GOLD: 'gold', AEM: 'gold', FNV: 'gold', WPM: 'gold',
  KGC: 'gold', BTG: 'gold', IAG: 'gold', EGO: 'gold', HMY: 'gold',
  AU: 'gold', DRD: 'gold', SSRM: 'gold', OR: 'gold', RGLD: 'gold',
  SAND: 'gold', NGD: 'gold', AUMN: 'gold', MAI: 'gold',
  // Silver ETFs (precious metals — same astro coverage as gold)
  SLV: 'gold', SIVR: 'gold', PSLV: 'gold', AGQ: 'gold', ZSL: 'gold',
  // Silver miner ETFs
  SIL: 'gold', SILJ: 'gold',
  // Silver mining stocks
  AG: 'gold', HL: 'gold', PAAS: 'gold', CDE: 'gold', MAG: 'gold',
  EXK: 'gold', SVM: 'gold', SILV: 'gold', FSM: 'gold',
  // Broad precious metals ETFs
  GLTR: 'gold', PPLT: 'gold',
  // Platinum / palladium (precious metals)
  PALL: 'gold', SPPP: 'gold',
  // Broad metals / mining ETFs
  XME: 'gold', PICK: 'gold', COPX: 'gold',
  // Oil / Energy ETFs
  USO: 'oil', UCO: 'oil', SCO: 'oil', DBO: 'oil', BNO: 'oil',
  XLE: 'oil', XOP: 'oil', OIH: 'oil', DRIP: 'oil', GUSH: 'oil',
  FENY: 'oil', VDE: 'oil', IYE: 'oil',
  // Oil / Energy stocks
  XOM: 'oil', CVX: 'oil', COP: 'oil', EOG: 'oil', PXD: 'oil',
  OXY: 'oil', DVN: 'oil', HES: 'oil', APA: 'oil', FANG: 'oil',
  MPC: 'oil', VLO: 'oil', PSX: 'oil', PBF: 'oil', DK: 'oil',
  SLB: 'oil', HAL: 'oil', BKR: 'oil', NOV: 'oil', HP: 'oil',
  LNG: 'oil', CTRA: 'oil', RRC: 'oil', AR: 'oil', EQT: 'oil',
  BP: 'oil', SHEL: 'oil', TTE: 'oil', E: 'oil', EC: 'oil',
  // Crypto ETFs
  GBTC: 'crypto', IBIT: 'crypto', FBTC: 'crypto', BITB: 'crypto',
  ETHA: 'crypto', EZBC: 'crypto', BTCO: 'crypto',
  // Banking / Financials ETFs
  XLF: 'banking', KBE: 'banking', KRE: 'banking', IAT: 'banking', FAZ: 'banking',
  // Major bank stocks
  BAC: 'banking', JPM: 'banking', WFC: 'banking', C: 'banking', GS: 'banking',
  MS: 'banking', USB: 'banking', PNC: 'banking', TFC: 'banking', COF: 'banking',
  SCHW: 'banking', BK: 'banking', STT: 'banking', FITB: 'banking', RF: 'banking',
  HBAN: 'banking', CFG: 'banking', MTB: 'banking', KEY: 'banking', ZION: 'banking',
  CMA: 'banking', FHN: 'banking', SNV: 'banking', ALLY: 'banking', SYF: 'banking',
  DFS: 'banking', AXP: 'banking', BX: 'banking', KKR: 'banking', APO: 'banking',
  // Tech ETFs
  QQQ: 'tech stocks', XLK: 'tech stocks', SMH: 'tech stocks', SOXX: 'tech stocks',
  // Tech stocks
  AAPL: 'tech stocks', MSFT: 'tech stocks', NVDA: 'tech stocks', GOOGL: 'tech stocks',
  GOOG: 'tech stocks', META: 'tech stocks', AMZN: 'tech stocks', TSLA: 'tech stocks',
  AMD: 'tech stocks', INTC: 'tech stocks', AVGO: 'tech stocks', QCOM: 'tech stocks',
  MU: 'tech stocks', AMAT: 'tech stocks', LRCX: 'tech stocks', KLAC: 'tech stocks',
  ASML: 'tech stocks', TSM: 'tech stocks', ORCL: 'tech stocks', CRM: 'tech stocks',
  NOW: 'tech stocks', SNOW: 'tech stocks', PLTR: 'tech stocks', UBER: 'tech stocks',
  SHOP: 'tech stocks', NET: 'tech stocks', CRWD: 'tech stocks', PANW: 'tech stocks',
  ADBE: 'tech stocks', INTU: 'tech stocks', NFLX: 'tech stocks', SPOT: 'tech stocks',
  // Currency
  UUP: 'currency', FXE: 'currency', FXY: 'currency', FXB: 'currency', FXF: 'currency',
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts)
  const json = await res.json()
  if (!res.ok) {
    const detail = json.detail
    const msg = Array.isArray(detail)
      ? detail.map(e => e.msg || JSON.stringify(e)).join('; ')
      : typeof detail === 'string'
        ? detail
        : JSON.stringify(detail) || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json
}

const ANALYSIS_TTL_MS = 15 * 60 * 1000  // 15 minutes — mirrors backend cache
const CACHE_PREFIX = 'analysis_cache_'

function getCachedAnalysis(ticker) {
  // Returns { result, stale } — stale=true means it's past TTL but usable while refreshing
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + ticker.toUpperCase())
    if (!raw) return null
    const entry = JSON.parse(raw)
    const stale = Date.now() - entry.cachedAt > ANALYSIS_TTL_MS
    return { result: entry.result, stale }
  } catch { return null }
}

function setCachedAnalysis(ticker, result) {
  try {
    localStorage.setItem(CACHE_PREFIX + ticker.toUpperCase(), JSON.stringify({ result, cachedAt: Date.now() }))
  } catch { /* storage full or unavailable */ }
}

export default function App() {
  const [loading, setLoading]     = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError]         = useState(null)
  const [data, setData]           = useState(null)
  const [ticker, setTicker]       = useState(null)
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
    setTicker(ticker.toUpperCase())

    try {
      // Detect asset type first so we call the right endpoints
      const detected = await apiFetch(`/detect/${ticker}`)
      const isStock = detected.asset_type === 'stock'

      const [price, news, technicals, smartMoney] = await Promise.all([
        apiFetch(isStock ? `/stock/price/${ticker}` : `/price/${ticker}`)
          .catch(() => ({ _unavailable: true, ticker: ticker.toUpperCase() })),
        apiFetch(isStock ? `/stock/news/${ticker}` : `/news/${ticker}`)
          .catch(() => ({ articles: [] })),
        apiFetch(isStock ? `/stock/technicals/${ticker}` : `/technicals/${ticker}`)
          .catch(() => ({ _unavailable: true })),
        isStock
          ? Promise.all([
              apiFetch(`/stock/insiders/${ticker}`).catch(() => null),
              apiFetch(`/stock/options/${ticker}`).catch(() => null),
            ])
          : apiFetch(`/whales/${ticker}`).catch(() => null),
      ])

      const [insiders, options] = isStock ? smartMoney : [null, null]
      const whales = isStock ? null : smartMoney

      const name = price?.name || detected.name || ticker.toUpperCase()
      setData({ price, news, technicals, whales, insiders, options, analysis: null, assetType: detected.asset_type, name })
      setLoading(false)

      // Only run AI analysis when core data is available
      const hasCoreData = !price?._unavailable && !technicals?._unavailable
      if (hasCoreData) {
        const cached = getCachedAnalysis(ticker)

        // Show stale or fresh cache instantly — no spinner
        if (cached) {
          setData(prev => ({ ...prev, analysis: cached.result }))
        }

        // If no cache or stale, fetch fresh in the background (no spinner if stale)
        if (!cached || cached.stale) {
          if (!cached) setAnalyzing(true)
          try {
            const analysis = await apiFetch('/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ticker,
                price_data: price,
                headlines: news.articles?.map(a => a.title) ?? [],
                technical_data: technicals,
                whale_data: whales ?? {},
                insider_data: insiders ?? {},
                options_data: options ?? {},
                astro_signal: astroData?.astro_signal ?? null,
              }),
            })
            setCachedAnalysis(ticker, analysis)
            setData(prev => ({ ...prev, analysis }))
          } catch {
            // Analysis failed — keep showing stale result if available
          }
        }
      }
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
        className="sticky top-0 z-50 px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
          {/* Logo + title row — on mobile also holds the LIVE badge */}
          <div className="flex items-center justify-between md:justify-start gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <div>
                <div className="text-sm font-bold tracking-widest text-white">
                  Futurotek
                </div>
                <div className="text-xs" style={{ color: '#475569' }}>
                  Ai Astro Trading
                </div>
              </div>
            </div>
            {/* LIVE badge shown in title row on mobile */}
            <div className="flex md:hidden items-center gap-2 text-xs" style={{ color: '#475569' }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block pulse-glow" />
              LIVE
            </div>
          </div>
          {/* Search bar — full width on mobile */}
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>
          {/* LIVE badge — desktop only */}
          <div className="hidden md:flex items-center gap-2 text-xs shrink-0"
            style={{ color: '#475569' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block pulse-glow" />
            LIVE
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Symbol name header */}
        {data && (
          <div className="fade-in flex items-baseline gap-3">
            <h1 className="text-3xl font-bold" style={{ color: '#f1f5f9' }}>{data.name}</h1>
            <span className="text-lg font-mono" style={{ color: '#475569' }}>{ticker}</span>
          </div>
        )}

        {/* Astro panel — only shown after a ticker has been searched */}
        {astroData && data && (
          <div className="fade-in">
            <AstroInsightsPanel
              astroData={astroData}
              visible={showAstro || !!ETF_TOPIC_MAP[ticker] || data?.assetType === 'crypto' || data?.assetType === 'stock'}
              onToggle={handleToggleAstro}
              ticker={ticker}
              matchedTopic={ticker ? (ETF_TOPIC_MAP[ticker] ?? (data.assetType === 'crypto' ? 'crypto' : data.assetType === 'stock' ? ['stock market', 'financial markets'] : null)) : null}
            />
          </div>
        )}

        {/* Idle state */}
        {!loading && !data && !error && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6 fade-in">
            {/* Hero */}
            <div className="text-center space-y-3">
              <div className="text-5xl mb-2">🔭 ♄</div>
              <h2 className="text-3xl font-bold" style={{ color: '#e2e8f0' }}>
                AI + Astro Trading Research
              </h2>
              <p className="text-base max-w-lg mx-auto" style={{ color: '#94a3b8' }}>
                Enter any stock or crypto ticker to get an instant AI-powered research report — combining technical analysis, news sentiment, and astrological market signals.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 text-xs">
              {[
                { icon: '📈', label: 'Technicals & Indicators' },
                { icon: '📰', label: 'News Sentiment' },
                { icon: '🐋', label: 'Whale & Smart Money' },
                { icon: '♄', label: 'Astro Signals' },
                { icon: '🤖', label: 'Claude AI Summary' },
              ].map(f => (
                <span key={f.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium"
                  style={{ background: '#111827', border: '1px solid #1e2d45', color: '#64748b' }}>
                  {f.icon} {f.label}
                </span>
              ))}
            </div>

            {/* Quick tickers */}
            <div className="text-center space-y-2">
              <p className="text-base font-semibold" style={{ color: '#94a3b8' }}>👇 Try a quick search below, or enter any symbol above in the search bar and click Analyze</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['BTC', 'ETH', 'SOL', 'AAPL', 'TSLA', 'NVDA', 'GLD', 'SPY'].map(t => (
                  <button key={t} onClick={() => handleSearch(t)}
                    className="px-4 py-2 rounded-lg text-sm font-mono font-semibold transition-all hover:scale-105 hover:brightness-125 cursor-pointer"
                    style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#94a3b8' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs" style={{ color: '#1e2d45' }}>
              Powered by CoinGecko · Finnhub · Claude AI · Financial Astrology
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-5 fade-in">
            <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: '#0f1a2e', border: '1px solid #1e3a5f' }}>
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-sm" style={{ color: '#94a3b8' }}>
                Fetching price, technicals, news, whale data and astro signals — please wait…
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
          (() => {
            const isInvalid = /not found|no price data|no market data|valid stock|valid.*ticker/i.test(error)
            return isInvalid ? (
              <div className="rounded-xl p-8 fade-in flex flex-col items-center gap-3 text-center"
                style={{ background: '#1a0f0f', border: '1px solid #7f1d1d' }}>
                <span className="text-5xl">🔍</span>
                <p className="text-xl font-bold text-red-400">Invalid Symbol — please try again</p>
                <p className="text-sm" style={{ color: '#94a3b8' }}>
                  We couldn't find <span className="font-mono font-semibold text-white">{ticker}</span>. Double-check the ticker and try again.
                </p>
              </div>
            ) : (
              <div className="rounded-xl p-5 fade-in flex items-start gap-3"
                style={{ background: '#1a0f0f', border: '1px solid #7f1d1d' }}>
                <span className="text-red-400 text-xl">⚠</span>
                <div>
                  <p className="text-red-400 font-medium">Error fetching data</p>
                  <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{error}</p>
                </div>
              </div>
            )
          })()
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
