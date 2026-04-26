import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './App.css'
import SearchBar from './components/SearchBar'
import AuthNav from './components/AuthNav'
import { getMe, isPublicDomain } from './lib/auth'

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true'
const AUTH_ACTIVE = AUTH_ENABLED && !isPublicDomain()
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

function setCachedAnalysis(ticker, result, alreadyStale = false) {
  try {
    // alreadyStale=true: store with a timestamp that is exactly at the TTL boundary
    // so the next check treats it as stale and re-fetches, but at least it's usable
    const cachedAt = alreadyStale ? Date.now() - ANALYSIS_TTL_MS : Date.now()
    localStorage.setItem(CACHE_PREFIX + ticker.toUpperCase(), JSON.stringify({ result, cachedAt }))
  } catch { /* storage full or unavailable */ }
}

const UPGRADE_DISMISS_KEY = 'usage_limit_dismissed_until'

function isDismissed() {
  try {
    const until = localStorage.getItem(UPGRADE_DISMISS_KEY)
    return until && Date.now() < Number(until)
  } catch { return false }
}

function dismissUntilMidnight() {
  try {
    const now = new Date()
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    localStorage.setItem(UPGRADE_DISMISS_KEY, String(midnight.getTime()))
  } catch {}
}

export default function App() {
  const [loading, setLoading]     = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError]         = useState(null)
  const [data, setData]           = useState(null)
  const [ticker, setTicker]       = useState(null)
  const [astroData, setAstroData] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [showAstro, setShowAstro] = useState(true)
  const [authedUser, setAuthedUser] = useState(() => {
    try {
      const raw = localStorage.getItem('ss_user')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  const fetchUsage = () => {
    if (!AUTH_ACTIVE) return
    apiFetch('/usage/today').then(u => {
      setUsage(u)
      if (!u.unlimited && u.count >= u.limit && !isDismissed()) setShowPaywall(true)
    }).catch(() => {})
  }

  useEffect(() => {
    if (AUTH_ACTIVE) {
      getMe().then(u => {
        setAuthedUser(u)
        if (u) fetchUsage()
      }).catch(() => {
        setAuthedUser(null)
        localStorage.removeItem('ss_user')
      })
    }
  }, [])
  const headerRef = useRef(null)

  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        document.documentElement.style.setProperty(
          '--header-h',
          `${headerRef.current.offsetHeight}px`
        )
      }
    }
    updateHeaderHeight()
    window.addEventListener('resize', updateHeaderHeight)
    return () => window.removeEventListener('resize', updateHeaderHeight)
  }, [])

  // Fetch astro data once on mount — independent of ticker searches
  useEffect(() => {
    apiFetch('/astro')
      .then(setAstroData)
      .catch(() => null) // silent failure
  }, [])

const handleToggleAstro = () => setShowAstro(prev => !prev)

  const handleSearch = async (ticker) => {
    if (AUTH_ACTIVE && !authedUser) {
      setShowAuthPrompt(true)
      return
    }
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

      // If price came back unavailable the symbol doesn't exist — bail out
      if (price?._unavailable) {
        setError('SYMBOL_NOT_FOUND')
        setLoading(false)
        return
      }

      const name = price?.name || detected.name || ticker.toUpperCase()

      setData({ price, news, technicals, whales, insiders, options, analysis: null, assetType: detected.asset_type, name })
      setLoading(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Only run AI analysis when price is available — technicals being unavailable is non-fatal
      const hasCoreData = !price?._unavailable
      if (hasCoreData) {
        const cached = getCachedAnalysis(ticker)

        // Show stale or fresh cache instantly — no spinner
        if (cached) {
          setData(prev => ({ ...prev, analysis: cached.result }))
        }

        // If no cache or stale, fetch from backend
        if (!cached || cached.stale) {
          // Only show spinner if there is nothing at all to display yet
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
            // Only reset the local cache timer when the backend ran Claude fresh.
            // If backend returned stale (from_cache=true), keep our existing TTL so
            // we re-check next search and pick up the background-refreshed result.
            if (!analysis.from_cache) {
              setCachedAnalysis(ticker, analysis)
            } else if (!cached) {
              // No local cache at all — store the stale result so other searches
              // on this device are instant, but mark it already-stale so we
              // re-fetch next time.
              setCachedAnalysis(ticker, analysis, true)
            }
            setData(prev => ({ ...prev, analysis }))
          } catch (analysisErr) {
            // Check if it's a rate limit error
            if (analysisErr.message?.includes('daily_limit') || analysisErr.message?.includes('429')) {
              fetchUsage()
            }
          } finally {
            setAnalyzing(false)
          }
        }
        fetchUsage()
      }
    } catch (err) {
      if (err.message?.includes('daily_limit')) {
        fetchUsage()
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
      setAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0e1a' }}>
      {/* Header */}
      <header ref={headerRef} style={{ background: '#0a0e1a', borderBottom: '1px solid #1e2d45' }}
        className="sticky top-0 z-50 px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
          {/* Logo + title row — on mobile also holds the LIVE badge */}
          <div className="flex items-center justify-between md:justify-start gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-3" style={{ textDecoration: 'none' }}
              onClick={() => { setData(null); setTicker(null); setError(null); setNavOpen(false) }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <div>
                <div className="text-sm font-bold tracking-widest text-white">
                  Starsignal.io
                </div>
                <div className="text-xs" style={{ color: '#94a3b8' }}>
                  Ai Astro Trading
                </div>
              </div>
            </Link>
            {/* LIVE badge shown in title row on mobile */}
            <div className="flex md:hidden items-center gap-2 text-xs" style={{ color: '#94a3b8' }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block pulse-glow" />
              LIVE
            </div>
          </div>
          {/* Search bar — full width on mobile */}
          <div className="flex-1">
            <SearchBar
              onSearch={handleSearch}
              loading={loading}
              onUnauthClick={AUTH_ACTIVE && !authedUser ? () => setShowAuthPrompt(true) : undefined}
            />
          </div>
          {/* LIVE badge — desktop only */}
          <div className="hidden md:flex items-center gap-2 text-xs shrink-0"
            style={{ color: '#94a3b8' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block pulse-glow" />
            LIVE
          </div>
          {/* Auth nav — only renders content when VITE_AUTH_ENABLED=true */}
          <div className="flex shrink-0">
            <AuthNav />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Symbol name header + section nav — sticky on mobile below the main header */}
        {data && (
          <>
            <div className="sticky z-40 -mx-4 px-4 md:mx-0 md:px-0"
              style={{ top: 'var(--header-h, 64px)', background: '#0a0e1a' }}>
            <div className="fade-in flex items-baseline gap-3 py-2 md:py-0">
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#f1f5f9' }}>{data.name}</h1>
              <span className="text-lg font-mono" style={{ color: '#94a3b8' }}>{ticker}</span>
            </div>

            {/* Section nav — hamburger on mobile, pill row on desktop */}
            {(() => {
              const navLinks = [
                { href: '#ai-summary',  label: '🤖 AI Summary',  show: !!data.analysis },
                { href: '#price',       label: '💰 Price',        show: true },
                { href: '#technicals',  label: '📈 Technicals',   show: true },
                { href: '#analysis',    label: '🔍 Analysis',     show: !!data.analysis },
                { href: '#smart-money', label: data.assetType === 'crypto' ? '🐋 Whales' : '📊 Insiders', show: !!(data.whales || data.insiders) },
                { href: '#astro',       label: '♅ Astro',         show: true },
                { href: '#news',        label: '📰 News',         show: true },
              ].filter(s => s.show)

              return (
                <nav className="fade-in rounded-xl" style={{ background: '#0b0f1e', border: '1px solid #1e2d45' }}>
                  {/* Mobile: hamburger header */}
                  <div className="flex md:hidden items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                      Jump to
                    </span>
                    <button
                      onClick={() => setNavOpen(o => !o)}
                      className="flex flex-col justify-center items-center gap-1 w-8 h-8 rounded-lg cursor-pointer transition-colors"
                      style={{ background: navOpen ? '#1e2d45' : 'transparent', border: '1px solid #1e2d45' }}
                      aria-label="Toggle navigation"
                    >
                      {navOpen ? (
                        // X icon
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <line x1="1" y1="1" x2="13" y2="13" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
                          <line x1="13" y1="1" x2="1" y2="13" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        // Hamburger icon
                        <>
                          <span className="block w-4 h-0.5 rounded" style={{ background: '#94a3b8' }} />
                          <span className="block w-4 h-0.5 rounded" style={{ background: '#94a3b8' }} />
                          <span className="block w-4 h-0.5 rounded" style={{ background: '#94a3b8' }} />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Mobile: dropdown links */}
                  {navOpen && (
                    <div className="flex flex-col md:hidden px-4 pb-3 gap-1" style={{ borderTop: '1px solid #1e2d45' }}>
                      {navLinks.map(s => (
                        <a key={s.href} href={s.href}
                          onClick={() => setNavOpen(false)}
                          className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:brightness-125"
                          style={{ color: '#94a3b8', background: '#111827', border: '1px solid #1e2d45' }}>
                          {s.label}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Desktop: horizontal pill row */}
                  <div className="hidden md:flex items-center gap-3 px-4 py-2.5 overflow-x-auto">
                    <span className="text-xs font-semibold uppercase tracking-widest shrink-0" style={{ color: '#94a3b8' }}>
                      Jump to
                    </span>
                    <div className="w-px h-4 shrink-0" style={{ background: '#1e2d45' }} />
                    {navLinks.map(s => (
                      <a key={s.href} href={s.href}
                        className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors hover:brightness-125"
                        style={{ background: '#111827', color: '#94a3b8', border: '1px solid #1e2d45' }}>
                        {s.label}
                      </a>
                    ))}
                  </div>
                </nav>
              )
            })()}
            </div>
          </>
        )}

        {/* Astro panel — only shown after a ticker has been searched */}
        {astroData && data && (
          <div id="astro" className="fade-in" style={{ scrollMarginTop: 'calc(var(--header-h, 72px) + 120px)' }}>
            <AstroInsightsPanel
              astroData={astroData}
              visible={showAstro}
              onToggle={handleToggleAstro}
              ticker={ticker}
              matchedTopic={ticker ? (ETF_TOPIC_MAP[ticker] ?? (data.assetType === 'crypto' ? 'crypto' : data.assetType === 'stock' ? ['stock market', 'financial markets'] : null)) : null}
            />
          </div>
        )}

        {/* Idle state */}
        {!loading && !data && !error && (
          <div className="flex flex-col items-center justify-center py-6 md:py-20 space-y-6 fade-in">
            {/* Hero */}
            <div className="text-center space-y-3">
              <div className="text-5xl mb-2">🔭 ♅</div>
              <p className="text-4xl md:text-5xl font-bold tracking-tight" style={{ color: '#e2e8f0' }}>Starsignal.io</p>
              <h2 className="text-lg font-semibold" style={{ color: '#94a3b8' }}>
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
                { icon: '♅', label: 'Astro Signals' },
                { icon: '🤖', label: 'Claude AI Summary' },
              ].map(f => (
                <span key={f.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium"
                  style={{ background: '#111827', border: '1px solid #1e2d45', color: '#94a3b8' }}>
                  {f.icon} {f.label}
                </span>
              ))}
            </div>

            {/* Quick tickers — hidden for logged-out users when auth is active */}
            <div className="text-center space-y-2">
              {(!AUTH_ACTIVE || authedUser) && (
                <>
                  <p className="text-base font-semibold" style={{ color: '#94a3b8' }}>👇 Try a quick search below, or enter any symbol above in the search bar and click Analyze</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['BTC', 'ETH', 'SOL', 'AAPL', 'TSLA', 'NVDA', 'GLD', 'SPY'].map(t => (
                      <button key={t}
                        onClick={() => handleSearch(t)}
                        className="px-4 py-2 rounded-lg text-sm font-mono font-semibold transition-all"
                        style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#94a3b8', cursor: 'pointer' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {AUTH_ACTIVE && !authedUser && (
                <p className="text-sm mt-2 font-medium" style={{ color: '#94a3b8' }}>
                  Please{' '}
                  <a href="/login" style={{ color: '#06b6d4', textDecoration: 'none' }}>login</a>
                  {' '}or{' '}
                  <a href="/beta" style={{ color: '#06b6d4', textDecoration: 'none' }}>apply for a free Beta Account</a>
                </p>
              )}
              {AUTH_ACTIVE && !authedUser && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
                  <div style={{ borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 315, aspectRatio: '9/16', background: '#0b1120' }}>
                    <video
                      src="/promo.mp4"
                      autoPlay muted loop playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs" style={{ color: '#94a3b8' }}>
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
          error === 'SYMBOL_NOT_FOUND' || /not found|no price data|no market data|valid stock|valid.*ticker/i.test(error) ? (
            <div className="rounded-xl p-8 fade-in flex flex-col items-center gap-3 text-center"
              style={{ background: '#1a0f0f', border: '1px solid #7f1d1d' }}>
              <span className="text-5xl">🔍</span>
              <p className="text-xl font-bold text-red-400">Symbol not found — try again</p>
              <p className="text-sm" style={{ color: '#94a3b8' }}>
                <span className="font-mono font-semibold text-white">{ticker}</span> could not be found. Check the symbol and try again.
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
        )}

        {/* Data panels */}
        {data && (
          <>
            {/* AI Sentiment banner */}
            <div id="ai-summary" style={{ scrollMarginTop: 'calc(var(--header-h, 72px) + 120px)' }}>
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

              {data.analysis && (
                <div className="fade-in">
                  <ResearchSummary analysis={data.analysis} ticker={data.price?.ticker} />
                </div>
              )}
            </div>

            {/* Price */}
            <div id="price" className="fade-in" style={{ scrollMarginTop: 'calc(var(--header-h, 72px) + 120px)' }}>
              <PriceCard price={data.price} />
            </div>

            {/* Opportunities & Risks — shown below price once analysis is ready */}
            {data.analysis && (
              <div className="fade-in">
                <OpportunitiesRisks analysis={data.analysis} />
              </div>
            )}

            {/* Technicals */}
            <div id="technicals" className="space-y-4" style={{ scrollMarginTop: 'calc(var(--header-h, 72px) + 120px)' }}>
              <div className="fade-in">
                <TechnicalGrid technicals={data.technicals} />
              </div>
              <div className="fade-in">
                <SupportResistance technicals={data.technicals} price={data.price} />
              </div>
            </div>

            {/* Analysis cards */}
            {data.analysis && (
              <div id="analysis" className="fade-in" style={{ scrollMarginTop: 'calc(var(--header-h, 72px) + 120px)' }}>
                <AnalysisCards analysis={data.analysis} />
              </div>
            )}

            {/* Smart money — whale (crypto) or insiders (stocks) */}
            <div id="smart-money" style={{ scrollMarginTop: 'calc(var(--header-h, 72px) + 120px)' }}>
              {data.whales && (
                <div className="fade-in">
                  <WhaleSection
                    whales={data.whales}
                    whaleAnalysis={data.analysis?.whale_sentiment_analysis}
                  />
                </div>
              )}
            </div>

            {/* News */}
            <div id="news" className="fade-in" style={{ scrollMarginTop: 'calc(var(--header-h, 72px) + 120px)' }}>
              <NewsSection news={data.news} newsSentiment={data.analysis?.news_sentiment} />
            </div>

          </>
        )}
      </main>

      {/* Site-wide footer */}
      {/* Usage bar — only for logged-in users with a limit */}
      {AUTH_ACTIVE && authedUser && usage && !usage.unlimited && (
        <div className="px-6 py-3" style={{ background: '#0a0e1a', borderTop: '1px solid #1e2d45' }}>
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="text-xs whitespace-nowrap" style={{ color: '#64748b' }}>
              {usage.count} of {usage.limit} requests used today
            </span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#1e2d45', height: 4 }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (usage.count / usage.limit) * 100)}%`,
                  background: usage.count / usage.limit >= 0.95 ? '#ef4444'
                            : usage.count / usage.limit >= 0.8  ? '#f59e0b'
                            : '#06b6d4',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Auth prompt modal */}
      {showAuthPrompt && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: 'rgba(6,10,20,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAuthPrompt(false)}
        >
          <div className="w-full max-w-sm rounded-2xl p-8 text-center" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}
            onClick={e => e.stopPropagation()}>
            <div className="text-3xl mb-4">✦</div>
            <h2 className="text-xl font-black mb-2" style={{ color: '#f1f5f9' }}>Please login or apply for a free Beta Account</h2>
            <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
              Create a free beta account to access AI-powered trading research.
            </p>
            <div className="flex flex-col gap-3">
              <a href="/login"
                className="block w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0', textDecoration: 'none' }}>
                Login
              </a>
              <a href="/beta"
                className="block w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', textDecoration: 'none' }}>
                Apply for free beta
              </a>
            </div>
            <button
              onClick={() => setShowAuthPrompt(false)}
              className="text-xs mt-4"
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Paywall modal */}
      {showPaywall && usage && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: 'rgba(6,10,20,0.85)', backdropFilter: 'blur(4px)' }}
        >
          <div className="w-full max-w-sm rounded-2xl p-8 text-center" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
            <div className="text-3xl mb-4">⚡</div>
            <h2 className="text-xl font-black mb-2" style={{ color: '#f1f5f9' }}>Daily limit reached</h2>
            <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
              You've used all {usage.limit} of today's requests.{' '}
              {usage.upgrade?.msg}
            </p>
            {usage.upgrade?.next && (
              <a
                href="/account"
                className="block w-full py-3 rounded-xl text-sm font-bold mb-3"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', textDecoration: 'none' }}
              >
                Upgrade to {usage.upgrade.next} — {usage.upgrade.price}
              </a>
            )}
            <button
              onClick={() => { dismissUntilMidnight(); setShowPaywall(false) }}
              className="text-xs"
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
            >
              Remind me tomorrow
            </button>
          </div>
        </div>
      )}

      <footer className="mt-4 px-6 py-8" style={{ borderTop: '1px solid #1e2d45', background: '#0a0e1a' }}>
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Top row: copyright left, links right */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <span className="text-xs" style={{ color: '#94a3b8' }}>© 2026 <a href="https://dianacastillo.zo.space/futurotek/" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Futurotek LLC</a>. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link to="/about" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>About</Link>
              <Link to="/partners" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Partners</Link>
              <Link to="/terms" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Terms of Service</Link>
              <Link to="/privacy" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Privacy Policy</Link>
              <Link to="/contact" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Contact</Link>
              <Link to="/feedback" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>Feedback</Link>
              <a href="https://www.linkedin.com/company/113175994/" target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#94a3b8' }}>LinkedIn</a>
            </div>
          </div>
          {/* Bottom muted line */}
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            Star Signal is a product of <a href="https://dianacastillo.zo.space/futurotek/" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Futurotek LLC</a>. Astrological insights are for informational purposes only and do not constitute investment advice.
          </p>
        </div>
      </footer>
    </div>
  )
}
