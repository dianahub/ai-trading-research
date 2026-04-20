import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMe, logout, tierLabel, isPublicDomain } from '../lib/auth'

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true'

function TierBadge({ tier }) {
  if (tier === 'beta') return (
    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
      style={{ background: '#0e3a4a', color: '#06b6d4', border: '1px solid #06b6d4' }}>
      Beta
    </span>
  )
  if (tier === 'founding') return (
    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
      style={{ background: '#2d1f00', color: '#f59e0b', border: '1px solid #f59e0b' }}>
      Founding
    </span>
  )
  return null
}

export default function AuthNav() {
  const [user, setUser] = useState(undefined) // undefined=loading, null=logged out, obj=logged in
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef(null)

  useEffect(() => {
    if (!AUTH_ENABLED || isPublicDomain()) { setUser(null); return }
    getMe().then(setUser).catch(() => setUser(null))
  }, [])

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (!AUTH_ENABLED || isPublicDomain()) return null
  if (user === undefined) return null

  if (!user) return (
    <div className="flex items-center gap-2">
      <Link to="/login"
        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
        style={{ background: 'transparent', border: '1px solid #1e2d45', color: '#94a3b8', textDecoration: 'none' }}>
        Login
      </Link>
      <Link to="/beta"
        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
        style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', color: '#fff', textDecoration: 'none' }}>
        Apply for Beta
      </Link>
    </div>
  )

  async function handleLogout() {
    await logout()
    setUser(null)
    navigate('/login')
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
        style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0', cursor: 'pointer' }}>
        <span>{user.first_name || user.email.split('@')[0]}</span>
        <TierBadge tier={user.tier} />
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 rounded-xl py-1 z-50 min-w-[160px]"
          style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
          <Link to="/dashboard" onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-xs hover:brightness-125"
            style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Dashboard
          </Link>
          <Link to="/account" onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-xs hover:brightness-125"
            style={{ color: '#94a3b8', textDecoration: 'none' }}>
            Account
          </Link>
          <div style={{ height: '1px', background: '#1e2d45', margin: '4px 0' }} />
          <button onClick={handleLogout}
            className="w-full text-left px-4 py-2.5 text-xs"
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
