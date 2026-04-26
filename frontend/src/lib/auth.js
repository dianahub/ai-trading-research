const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PUBLIC_DOMAINS = ['ai-trading-research.vercel.app']

export function isPublicDomain() {
  if (typeof window === 'undefined') return false
  return PUBLIC_DOMAINS.includes(window.location.hostname)
}

export async function getMe() {
  // Fast path: check localStorage first for immediate UI updates
  let cachedUser = null
  try {
    const raw = localStorage.getItem('ss_user')
    if (raw) cachedUser = JSON.parse(raw)
  } catch {}

  try {
    const r = await fetch(`${API}/auth/me`, { credentials: 'include' })
    if (!r.ok) {
      localStorage.removeItem('ss_user')
      return null
    }
    const d = await r.json()
    if (d.user) {
      localStorage.setItem('ss_user', JSON.stringify(d.user))
    } else {
      localStorage.removeItem('ss_user')
    }
    return d.user
  } catch (err) {
    // If network fails, return cached user as best-effort
    return cachedUser
  }
}

export async function login(email, password, rememberMe = false) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, remember_me: rememberMe }),
  })
  let d = {}
  try { const t = await r.text(); if (t) d = JSON.parse(t) } catch {}
  if (!r.ok) throw new Error(d.detail || 'Login failed')

  if (d.user) {
    localStorage.setItem('ss_user', JSON.stringify(d.user))
  }
  return d
}

export async function signup(email, password, firstName, lastName, ref) {
  const r = await fetch(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName, ref }),
  })
  let d = {}
  try { const t = await r.text(); if (t) d = JSON.parse(t) } catch {}
  if (!r.ok) throw new Error(d.detail || 'Signup failed')
  return d
}

export async function logout() {
  localStorage.removeItem('ss_user')
  await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
}

export async function getFeatures() {
  const r = await fetch(`${API}/auth/features`, { credentials: 'include' })
  if (!r.ok) return { tier: 'free', features: {} }
  return r.json()
}

export async function getAccount() {
  const r = await fetch(`${API}/auth/account`, { credentials: 'include' })
  if (!r.ok) return null
  return r.json()
}

export function tierLabel(tier) {
  return { free: 'Free', beta: 'Beta', pro: 'Pro', premium: 'Premium', platform: 'Platform' }[tier] || tier
}

export function tierColor(tier) {
  return {
    free: '#94a3b8', beta: '#06b6d4', pro: '#3b82f6',
    premium: '#8b5cf6', platform: '#d4a847',
  }[tier] || '#94a3b8'
}
