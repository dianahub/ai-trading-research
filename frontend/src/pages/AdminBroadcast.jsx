import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAdminHeaders() {
  return { 'x-admin-email': 'contact@starsignal.io', 'x-admin-password': 'BISCUITLOVE', 'Content-Type': 'application/json' }
}

const ROLES = [
  { value: 'user',        label: 'Users (role: user)' },
  { value: 'astrologer',  label: 'Astrologers (role: astrologer)' },
  { value: 'influencer',  label: 'Influencers (role: influencer)' },
  { value: 'admin',       label: 'Admins (role: admin)' },
  { value: 'all',         label: 'Everyone (all roles)' },
]

const BTN = { background: '#0f1a2e', color: '#94a3b8', border: '1px solid #1e3a5f', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 600, lineHeight: 1 }
const BTN_ACTIVE = { ...BTN, background: '#1e3a5f', color: '#f1f5f9', borderColor: '#2563eb' }

function ToolbarBtn({ onClick, active, children, title }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      style={active ? BTN_ACTIVE : BTN}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }) {
  if (!editor) return null
  return (
    <div className="flex flex-wrap gap-1 px-3 py-2" style={{ borderBottom: '1px solid #1e3a5f' }}>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">B</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><s>S</s></ToolbarBtn>
      <div style={{ width: 1, background: '#1e3a5f', margin: '0 4px' }} />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolbarBtn>
      <div style={{ width: 1, background: '#1e3a5f', margin: '0 4px' }} />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">• List</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1. List</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">"</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">{`<>`}</ToolbarBtn>
      <div style={{ width: 1, background: '#1e3a5f', margin: '0 4px' }} />
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} active={false} title="Undo">↩</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} active={false} title="Redo">↪</ToolbarBtn>
    </div>
  )
}

export default function AdminBroadcast() {
  const [role, setRole]             = useState('user')
  const [subject, setSubject]       = useState('')
  const [preview, setPreview]       = useState(null)
  const [confirm, setConfirm]       = useState(false)
  const [result, setResult]         = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [loading, setLoading]       = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [error, setError]           = useState('')

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: {
      attributes: {
        style: 'min-height: 220px; outline: none; padding: 12px; color: #e2e8f0; font-size: 14px; line-height: 1.7;',
      },
    },
  })

  const getHtml = useCallback(() => editor?.getHTML() ?? '', [editor])
  const isEmpty = useCallback(() => !editor || editor.isEmpty, [editor])

  async function handlePreview() {
    setError('')
    setPreview(null)
    setLoading(true)
    try {
      const r = await fetch(`${API}/admin/broadcast-email/preview?role=${role}`, { headers: getAdminHeaders() })
      if (!r.ok) throw new Error(await r.text())
      setPreview(await r.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    if (!subject.trim() || isEmpty()) { setError('Subject and body are required.'); return }
    setConfirm(false)
    setResult(null)
    setError('')
    setLoading(true)
    try {
      const r = await fetch(`${API}/admin/broadcast-email`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ role, subject, body: getHtml() }),
      })
      if (!r.ok) throw new Error(await r.text())
      setResult(await r.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleTest() {
    if (!subject.trim() || isEmpty()) { setError('Subject and body are required.'); return }
    setTestResult(null)
    setError('')
    setTestLoading(true)
    try {
      const r = await fetch(`${API}/admin/broadcast-email/test`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ subject, body: getHtml() }),
      })
      if (!r.ok) throw new Error(await r.text())
      setTestResult(await r.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setTestLoading(false)
    }
  }

  const canSend = subject.trim() && !isEmpty()

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      {/* Editor styles injected inline */}
      <style>{`
        .tiptap-editor h1 { font-size: 1.5rem; font-weight: 700; margin: 0.75rem 0 0.4rem; color: #f1f5f9; }
        .tiptap-editor h2 { font-size: 1.25rem; font-weight: 700; margin: 0.75rem 0 0.4rem; color: #f1f5f9; }
        .tiptap-editor h3 { font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0 0.3rem; color: #f1f5f9; }
        .tiptap-editor p  { margin: 0.25rem 0; }
        .tiptap-editor ul { list-style: disc; padding-left: 1.4rem; margin: 0.4rem 0; }
        .tiptap-editor ol { list-style: decimal; padding-left: 1.4rem; margin: 0.4rem 0; }
        .tiptap-editor blockquote { border-left: 3px solid #2563eb; padding-left: 0.75rem; color: #93c5fd; margin: 0.5rem 0; }
        .tiptap-editor code { background: #0f172a; color: #a5b4fc; border-radius: 4px; padding: 1px 5px; font-size: 13px; }
        .tiptap-editor strong { color: #f1f5f9; }
      `}</style>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link to="/admin" className="text-xs mb-8 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>
          ← Admin
        </Link>
        <h1 className="text-3xl font-black mb-1" style={{ color: '#f1f5f9' }}>Broadcast Email</h1>
        <p className="text-sm mb-8" style={{ color: '#94a3b8' }}>Send an email to all users in a given role, one by one.</p>

        <div className="rounded-xl mb-6 overflow-hidden" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
          <div className="p-6 pb-0">
            {/* Role */}
            <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>RECIPIENT ROLE</label>
            <select
              value={role}
              onChange={e => { setRole(e.target.value); setPreview(null); setResult(null) }}
              className="w-full rounded-lg px-3 py-2 text-sm mb-4"
              style={{ background: '#0f1a2e', color: '#e2e8f0', border: '1px solid #1e3a5f', outline: 'none' }}
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            {/* Subject */}
            <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>SUBJECT</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="w-full rounded-lg px-3 py-2 text-sm mb-4"
              style={{ background: '#0f1a2e', color: '#e2e8f0', border: '1px solid #1e3a5f', outline: 'none' }}
            />

            {/* Body label */}
            <label className="block text-xs font-semibold mb-2" style={{ color: '#94a3b8' }}>BODY</label>
          </div>

          {/* WYSIWYG editor */}
          <div style={{ border: '1px solid #1e3a5f', borderLeft: 'none', borderRight: 'none' }}>
            <Toolbar editor={editor} />
            <div className="tiptap-editor" style={{ background: '#0f1a2e' }}>
              <EditorContent editor={editor} />
            </div>
          </div>

          <div className="p-6 pt-5">
            {/* Error */}
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: '#450a0a', color: '#f87171', border: '1px solid #7f1d1d' }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handlePreview}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: '#1e3a5f', color: '#93c5fd', border: '1px solid #2563eb' }}
              >
                {loading ? 'Loading…' : 'Preview Recipients'}
              </button>
              <button
                onClick={handleTest}
                disabled={testLoading || !canSend}
                className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: '#1e1b4b', color: '#a5b4fc', border: '1px solid #4338ca', opacity: !canSend ? 0.5 : 1 }}
              >
                {testLoading ? 'Sending…' : 'Send Test Email'}
              </button>
              <button
                onClick={() => { if (!canSend) { setError('Subject and body are required.'); return } setConfirm(true) }}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: '#052e16', color: '#34d399', border: '1px solid #065f46', opacity: !canSend ? 0.5 : 1 }}
              >
                Send to Role
              </button>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        {preview && (
          <div className="rounded-xl p-5 mb-4" style={{ background: '#0b1120', border: '1px solid #1e3a5f' }}>
            <div className="text-sm font-semibold mb-3" style={{ color: '#93c5fd' }}>
              {preview.count} recipient{preview.count !== 1 ? 's' : ''} for role <span style={{ color: '#f1f5f9' }}>{role}</span>
            </div>
            {preview.count > 0 && (
              <div className="text-xs space-y-1" style={{ color: '#94a3b8', maxHeight: 160, overflowY: 'auto' }}>
                {preview.emails.map(e => <div key={e}>{e}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div className="rounded-xl px-5 py-4 mb-4 text-sm" style={{ background: '#052e16', color: '#34d399', border: '1px solid #065f46' }}>
            Test email sent to <strong>dianahelene@gmail.com</strong>
          </div>
        )}

        {/* Broadcast result */}
        {result && (
          <div className="rounded-xl p-5 mb-4" style={{ background: '#0b1120', border: '1px solid #065f46' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: '#34d399' }}>
              Sent {result.sent} / {result.total} emails
            </div>
            {result.errors.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: '#f87171' }}>Errors ({result.errors.length})</div>
                <div className="text-xs space-y-1" style={{ color: '#94a3b8', maxHeight: 120, overflowY: 'auto' }}>
                  {result.errors.map((e, i) => <div key={i}><span style={{ color: '#f87171' }}>{e.email}</span>: {e.error}</div>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-sm rounded-xl p-6" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
            <h2 className="text-lg font-bold mb-2" style={{ color: '#f1f5f9' }}>Confirm Broadcast</h2>
            <p className="text-sm mb-1" style={{ color: '#94a3b8' }}>
              You are about to send <strong style={{ color: '#f1f5f9' }}>{subject}</strong> to all users with role <strong style={{ color: '#f1f5f9' }}>{role}</strong>.
            </p>
            {preview && (
              <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>
                That's <strong style={{ color: '#f1f5f9' }}>{preview.count}</strong> recipient{preview.count !== 1 ? 's' : ''}.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleSend}
                className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: '#052e16', color: '#34d399', border: '1px solid #065f46' }}
              >
                Yes, Send
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: '#1e2d45', color: '#94a3b8', border: '1px solid #1e3a5f' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
