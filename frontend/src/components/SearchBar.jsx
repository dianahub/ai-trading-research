import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export default function SearchBar({ onSearch, loading }) {
  const [input, setInput]         = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen]           = useState(false)
  const [fetching, setFetching]   = useState(false)
  const wrapperRef                = useRef(null)
  const debouncedInput            = useDebounce(input, 280)

  // Fetch suggestions whenever debounced input changes
  useEffect(() => {
    const q = debouncedInput.trim()
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }

    setFetching(true)
    fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`)
      .then(r => r.ok ? r.json() : { results: [] })
      .then(data => {
        setSuggestions(data.results ?? [])
        setOpen((data.results ?? []).length > 0)
      })
      .catch(() => setSuggestions([]))
      .finally(() => setFetching(false))
  }, [debouncedInput])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (symbol, name) => {
    setInput(name ? `${symbol} — ${name}` : symbol)
    setOpen(false)
    setSuggestions([])
    onSearch(symbol)
  }

  const submit = async () => {
    const raw = input.trim()
    if (!raw) return
    setOpen(false)

    // If suggestions already loaded, use top match
    if (suggestions.length > 0) {
      select(suggestions[0].symbol, suggestions[0].name)
      return
    }

    // If input looks like a ticker symbol, send as-is
    const looksLikeSymbol = /^[A-Z0-9.]{1,6}$/i.test(raw) && !raw.includes(' ')
    if (looksLikeSymbol) {
      onSearch(raw.toUpperCase())
      return
    }

    // Input looks like a name — fetch suggestions synchronously then use top hit
    setFetching(true)
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(raw)}`)
      const json = await res.json()
      const results = json.results ?? []
      if (results.length > 0) {
        select(results[0].symbol, results[0].name)
        return
      }
    } catch { /* fall through */ }
    finally { setFetching(false) }

    // Nothing found — pass raw and let backend surface the error
    onSearch(raw.toUpperCase())
  }

  return (
    <div className="flex gap-2" ref={wrapperRef}>
      <div className="relative flex-1">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: '#475569' }}
        />
        <input
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); }}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false) }}
          placeholder="Symbol or name  (BTC, Apple, Tesla…) — pick from list"
          className="w-full pl-10 pr-4 py-3.5 md:py-2.5 rounded-lg text-base md:text-sm font-mono outline-none transition-all"
          style={{
            background: '#111827',
            border: '1px solid #1e2d45',
            color: '#e2e8f0',
          }}
          onFocus={e => { e.target.style.borderColor = '#06b6d4'; if (suggestions.length) setOpen(true) }}
          onBlur={e => e.target.style.borderColor = '#1e2d45'}
          autoComplete="off"
        />

        {/* Autocomplete dropdown */}
        {open && suggestions.length > 0 && (
          <div
            className="absolute z-50 left-0 right-0 mt-1 rounded-lg overflow-hidden"
            style={{ background: '#111827', border: '1px solid #1e3a5f', boxShadow: '0 8px 32px #00000088' }}
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={() => select(s.symbol, s.name)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:brightness-125"
                style={{ background: 'transparent', borderBottom: i < suggestions.length - 1 ? '1px solid #1e2d45' : 'none' }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-semibold text-sm" style={{ color: '#06b6d4' }}>{s.symbol}</span>
                  <span className="text-sm truncate" style={{ color: '#94a3b8', maxWidth: 220 }}>{s.name}</span>
                </div>
                <span
                  className="text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: s.type === 'crypto' ? '#312e8144' : '#05281644',
                    color: s.type === 'crypto' ? '#a5b4fc' : '#10b981',
                    border: `1px solid ${s.type === 'crypto' ? '#4338ca44' : '#065f4644'}`,
                  }}
                >
                  {s.type === 'crypto' ? 'Crypto' : 'Stock'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={submit}
        disabled={loading || !input.trim()}
        className="px-5 py-3.5 md:py-2.5 rounded-lg text-base md:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 cursor-pointer"
        style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff' }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            Loading
          </span>
        ) : 'Analyze'}
      </button>
    </div>
  )
}
