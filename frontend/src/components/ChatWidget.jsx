// ChatWidget.jsx — floating chat bubble (bottom-right corner)
import { useState, useRef, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const GREETING = "Hi! I'm Celeste ♅ — your astrological market guide. Ask me anything about the current signals, or about the ticker you're researching."

export default function ChatWidget({ usesLeft, onUse, ticker }) {
  const [open, setOpen]       = useState(false)
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  // Conversation shown in UI (includes greeting). API messages are derived separately.
  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING, ui: true }
  ])
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const exhausted  = usesLeft <= 0

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      if (!exhausted) setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [messages, open])

  const send = async () => {
    const text = input.trim()
    if (!text || loading || exhausted) return

    const userMsg = { role: 'user', content: text }
    const next    = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    onUse()

    // Build API message list: exclude UI-only greeting, keep real history
    const apiMessages = next
      .filter(m => !m.ui)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch(`${API}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: apiMessages, ticker: ticker || '' }),
      })
      if (!res.ok) throw new Error('bad response')
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I couldn\'t connect right now. Please try again in a moment.',
      }])
    }
    setLoading(false)
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const usageColor = usesLeft <= 2 ? '#ef4444' : usesLeft <= 5 ? '#f59e0b' : '#94a3b8'

  return (
    <>
      {/* Floating bubble button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open Celeste chat"
        style={{
          position:     'fixed',
          bottom:       24,
          right:        24,
          zIndex:       9999,
          width:        52,
          height:       52,
          borderRadius: '50%',
          background:   'linear-gradient(135deg, #1e1b4b, #312e81)',
          border:       '1px solid #3730a3',
          boxShadow:    '0 0 20px #3730a366',
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     22,
          transition:   'transform 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {open ? '✕' : '♅'}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position:     'fixed',
            bottom:       88,
            right:        24,
            zIndex:       9998,
            width:        340,
            height:       460,
            borderRadius: 16,
            background:   '#0b0f1e',
            border:       '1px solid #1e2d45',
            boxShadow:    '0 8px 40px rgba(0,0,0,0.6)',
            display:      'flex',
            flexDirection:'column',
            overflow:     'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding:      '12px 16px',
            borderBottom: '1px solid #1e2d45',
            background:   'linear-gradient(135deg, #1e1b4b, #0f1a2e)',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            flexShrink:   0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #312e81, #1e1b4b)',
                border: '1px solid #3730a3',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>♅</div>
              <div>
                <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13, margin: 0 }}>Celeste</p>
                <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>Astro Market Guide</p>
              </div>
            </div>
            <span style={{ fontSize: 11, color: usageColor }}>
              {usesLeft} use{usesLeft !== 1 ? 's' : ''} left
            </span>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth:     '82%',
                  padding:      '8px 12px',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background:   m.role === 'user' ? 'linear-gradient(135deg, #1e1b4b, #312e81)' : '#111827',
                  border:       `1px solid ${m.role === 'user' ? '#3730a3' : '#1e2d45'}`,
                  color:        '#e2e8f0',
                  fontSize:     13,
                  lineHeight:   1.5,
                  whiteSpace:   'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '8px 14px', borderRadius: '12px 12px 12px 2px',
                  background: '#111827', border: '1px solid #1e2d45',
                  display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(n => (
                    <span key={n} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#6366f1',
                      animation: `bounce 1s ease-in-out ${n * 0.15}s infinite`,
                      display: 'inline-block',
                    }} />
                  ))}
                </div>
              </div>
            )}
            {exhausted && (
              <div style={{
                margin: '8px 0', padding: '10px 12px', borderRadius: 10,
                background: '#1a0f0f', border: '1px solid #7f1d1d',
                color: '#fca5a5', fontSize: 12, textAlign: 'center',
              }}>
                You've used all 10 free analyses for today. Come back tomorrow or upgrade for unlimited access.
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding:    '10px 12px',
            borderTop:  '1px solid #1e2d45',
            display:    'flex',
            gap:        8,
            flexShrink: 0,
            background: '#0b0f1e',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              disabled={exhausted || loading}
              placeholder={exhausted ? 'No uses remaining' : 'Ask Celeste…'}
              rows={1}
              style={{
                flex:        1,
                background:  '#111827',
                border:      '1px solid #1e2d45',
                borderRadius: 8,
                color:       '#e2e8f0',
                fontSize:    13,
                padding:     '7px 10px',
                resize:      'none',
                outline:     'none',
                fontFamily:  'inherit',
                opacity:     exhausted ? 0.5 : 1,
                lineHeight:  1.4,
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading || exhausted}
              style={{
                padding:      '7px 12px',
                borderRadius: 8,
                background:   (!input.trim() || loading || exhausted) ? '#1e2d45' : 'linear-gradient(135deg, #1e1b4b, #312e81)',
                border:       '1px solid #3730a3',
                color:        '#a5b4fc',
                fontSize:     16,
                cursor:       (!input.trim() || loading || exhausted) ? 'not-allowed' : 'pointer',
                flexShrink:   0,
                display:      'flex',
                alignItems:   'center',
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Bounce animation keyframes */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  )
}
