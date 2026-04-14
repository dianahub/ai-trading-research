import { useState } from 'react'
import { Search } from 'lucide-react'

export default function SearchBar({ onSearch, loading }) {
  const [input, setInput] = useState('')

  const submit = () => {
    const t = input.trim().toUpperCase()
    if (t) onSearch(t)
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: '#475569' }}
        />
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Enter symbol  (BTC, ETH, AAPL, TSLA…)"
          className="w-full pl-10 pr-4 py-3.5 md:py-2.5 rounded-lg text-base md:text-sm font-mono outline-none transition-all"
          style={{
            background: '#111827',
            border: '1px solid #1e2d45',
            color: '#e2e8f0',
          }}
          onFocus={e => (e.target.style.borderColor = '#06b6d4')}
          onBlur={e => (e.target.style.borderColor = '#1e2d45')}
        />
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
