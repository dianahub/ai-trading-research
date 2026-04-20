import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { getAccount, logout, tierLabel, tierColor } from '../lib/auth'

export default function DashboardPage() {
  const [account, setAccount] = useState(null)
  const [params] = useSearchParams()
  const [showWelcome, setShowWelcome] = useState(params.get('welcome') === '1')
  const navigate = useNavigate()

  useEffect(() => {
    getAccount().then(a => {
      if (!a) { navigate('/login'); return }
      setAccount(a)
    })
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  if (!account) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}>
      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      {/* Welcome modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(6,10,20,0.85)' }}>
          <div className="w-full max-w-md rounded-2xl p-8" style={{ background: '#0b1120', border: '1px solid #1e3a5f' }}>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">✦</div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#f1f5f9' }}>
                Welcome to Star Signal
              </h2>
              <p className="text-sm" style={{ color: '#94a3b8' }}>
                You have <strong style={{ color: '#06b6d4' }}>30 days free</strong>.
                Here's how to get started.
              </p>
            </div>
            <div className="space-y-4 mb-8">
              {[
                { step: '1', title: 'Search any ticker', desc: 'Enter BTC, AAPL, GLD or any symbol in the search bar to get an instant AI analysis.' },
                { step: '2', title: 'Read the astro signal', desc: 'The astrological panel shows current planetary influences on your asset class.' },
                { step: '3', title: 'Check whale & smart money', desc: 'See what large holders and insiders are doing before you make a move.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff' }}>
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowWelcome(false)}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff' }}>
              Start Exploring →
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 px-6 py-4"
        style={{ background: 'rgba(6,10,20,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d45' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>✦</div>
            <span className="text-white font-bold tracking-widest text-sm">Star Signal</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/account" className="text-xs" style={{ color: '#64748b', textDecoration: 'none' }}>Account</Link>
            <button onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'transparent', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
            Hey {account.first_name || 'there'} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            <span className="font-semibold"
              style={{ color: tierColor(account.tier) }}>
              {tierLabel(account.tier)}
            </span>
            {account.beta_days_left != null && (
              <span style={{ color: '#475569' }}> · {account.beta_days_left} days left in beta</span>
            )}
          </p>
        </div>

        <div className="rounded-2xl p-8 text-center" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
          <div className="text-4xl mb-4">🔭</div>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#f1f5f9' }}>Ready to research?</h2>
          <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
            Head to the main dashboard to search any ticker.
          </p>
          <Link to="/"
            className="inline-block px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', textDecoration: 'none' }}>
            Go to Star Signal →
          </Link>
        </div>
      </div>
    </div>
  )
}
