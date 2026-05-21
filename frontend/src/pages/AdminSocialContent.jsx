import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function adminHeaders() {
  return {
    'Content-Type':     'application/json',
    'x-admin-email':    'contact@starsignal.io',
    'x-admin-password': 'BISCUITLOVE',
  }
}

const STATUS_COLOR = {
  posted:  { bg: '#052e1a', border: '#10b981', text: '#34d399' },
  failed:  { bg: '#2d0a0a', border: '#ef4444', text: '#f87171' },
  skipped: { bg: '#1e2d45', border: '#475569', text: '#94a3b8' },
  pending: { bg: '#2d1a00', border: '#f59e0b', text: '#fbbf24' },
}

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.pending
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {status?.toUpperCase()}
    </span>
  )
}

function ActionButton({ onClick, loading, label, loadingLabel, color, textColor, border, disabled }) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className="rounded-lg px-4 py-2 text-sm font-semibold"
      style={{ background: color, border: `1px solid ${border}`, color: textColor,
        cursor: (loading || disabled) ? 'default' : 'pointer', opacity: (loading || disabled) ? 0.6 : 1 }}>
      {loading ? loadingLabel : label}
    </button>
  )
}

export default function AdminSocialContent() {
  const [posts, setPosts]           = useState([])
  const [settings, setSettings]     = useState(null)
  const [preview, setPreview]       = useState(null)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [forcedHeadline, setForcedHeadline] = useState('')
  const [newsSuggestions, setNewsSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const newsDebounceRef = useRef(null)
  const newsInputRef = useRef(null)
  const [posting, setPosting]       = useState(false)
  const [skipping, setSkipping]     = useState(false)
  const [running, setRunning]       = useState(false)
  const [expanded, setExpanded]     = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletingVideoId, setDeletingVideoId] = useState(null)
  const [statusMsg, setStatusMsg]   = useState('')
  const [pollTimer, setPollTimer]   = useState(null)
  const [regenThumb, setRegenThumb] = useState(false)
  const [thumbKey, setThumbKey]     = useState(Date.now()) // cache-bust thumbnail img

  // Upload & post your own video
  const [uploadFile, setUploadFile]       = useState(null)
  const [uploading, setUploading]         = useState(false)
  const [uploadResult, setUploadResult]   = useState(null)
  const [uploadMsg, setUploadMsg]         = useState('')

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true)
    try {
      const r = await fetch(`${API}/admin/social/posts`, { headers: adminHeaders() })
      const d = await r.json()
      setPosts(d.posts ?? [])
    } catch (e) { console.error(e) }
    setLoadingPosts(false)
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const r = await fetch(`${API}/admin/social/settings`, { headers: adminHeaders() })
      setSettings(await r.json())
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    loadPosts()
    loadSettings()
    return () => { if (pollTimer) clearInterval(pollTimer) }
  }, [])

  // Poll for preview status after generating
  const startPolling = useCallback(() => {
    const timer = setInterval(async () => {
      const r = await fetch(`${API}/admin/social/preview-status`, { headers: adminHeaders() })
      const d = await r.json()
      if (d.ready) {
        clearInterval(timer)
        setPollTimer(null)
        setGenerating(false)
        setPreview(d)
        setStatusMsg(
          d.status === 'failed'  ? `Preview failed: ${d.error}` :
          d.status === 'skipped' ? `Skipped: ${d.error ?? 'no unused insights available'}` :
          'Preview ready — review below.'
        )
      }
    }, 8000)
    setPollTimer(timer)
  }, [])

  const handleNewsSearch = async () => {
    const q = forcedHeadline.trim()
    if (!q) return
    setLoadingSuggestions(true)
    setShowSuggestions(false)
    try {
      const r = await fetch(`${API}/admin/social/news-search?q=${encodeURIComponent(q)}`, { headers: adminHeaders() })
      const d = await r.json()
      setNewsSuggestions(d.headlines || [])
      setShowSuggestions(true)
    } catch { setNewsSuggestions([]) }
    setLoadingSuggestions(false)
  }

  const handleGeneratePreview = async () => {
    setGenerating(true)
    setPreview(null)
    setStatusMsg('Generating preview — this takes 2–5 minutes...')
    try {
      const r = await fetch(`${API}/admin/social/generate-preview`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ forced_headline: forcedHeadline.trim() || null }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setStatusMsg(`Failed to start: ${d.detail ?? r.status}`)
        setGenerating(false)
        return
      }
    } catch (e) {
      setStatusMsg(`Network error: ${e}`)
      setGenerating(false)
      return
    }
    startPolling()
  }

  const handlePostPreview = async () => {
    if (!preview?.post) return
    setPosting(true)
    setStatusMsg('Posting to Instagram, Facebook & YouTube...')
    try {
      const r = await fetch(`${API}/admin/social/post-preview`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ post: preview.post, thumbnail_url: preview.thumbnail_url ?? null, news_headline: preview.news_headline ?? null }),
      })
      const d = await r.json()
      if (d.posted) {
        setStatusMsg(`Posted! ${d.permalink}`)
        setPreview(null)
        loadPosts()
      } else {
        setStatusMsg(`Post failed: ${d.error ?? JSON.stringify(d)}`)
      }
    } catch (e) { setStatusMsg(`Error: ${e}`) }
    setPosting(false)
  }

  const handleSkipToday = async () => {
    setSkipping(true)
    await fetch(`${API}/admin/social/skip-today`, { method: 'POST', headers: adminHeaders() })
    setStatusMsg("Today marked as skipped.")
    await loadPosts()
    setSkipping(false)
  }

  const handleRunNow = async () => {
    setRunning(true)
    setStatusMsg('Job triggered — will post automatically if AUTO_POST_ENABLED=true. Check log below.')
    await fetch(`${API}/admin/social/run-now`, { method: 'POST', headers: adminHeaders() })
    setTimeout(() => { loadPosts(); setRunning(false) }, 5000)
  }


  const handleDeletePost = async (postId) => {
    setDeletingId(postId)
    setConfirmDeleteId(null)
    try {
      const r = await fetch(`${API}/admin/social/posts/${postId}`, { method: 'DELETE', headers: adminHeaders() })
      const body = await r.json().catch(() => ({}))
      console.log('[delete]', r.status, body)
      if (r.ok) {
        setExpanded(null)
        await loadPosts()
      } else {
        setStatusMsg(`Delete failed (${r.status}): ${body.detail ?? JSON.stringify(body)}`)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (e) {
      console.error('[delete error]', e)
      setStatusMsg(`Delete error: ${e}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setDeletingId(null)
  }

  const handleRegenThumbnail = async () => {
    setRegenThumb(true)
    try {
      const r = await fetch(`${API}/admin/social/preview/regenerate-thumbnail`, { method: 'POST', headers: adminHeaders() })
      const d = await r.json()
      if (d.thumbnail_url) {
        setPreview(prev => ({ ...prev, thumbnail_url: d.thumbnail_url }))
        setThumbKey(Date.now())
        setStatusMsg('Thumbnail regenerated.')
      } else {
        setStatusMsg(`Regen failed: ${d.detail ?? JSON.stringify(d)}`)
      }
    } catch (e) { setStatusMsg(`Error: ${e}`) }
    setRegenThumb(false)
  }

  const handleDeleteVideo = async (postId) => {
    setDeletingVideoId(postId)
    try {
      const r = await fetch(`${API}/admin/social/posts/${postId}/video`, { method: 'DELETE', headers: adminHeaders() })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        await loadPosts()
        setStatusMsg('Video file deleted.')
      } else {
        setStatusMsg(`Delete failed: ${d.detail ?? JSON.stringify(d)}`)
      }
    } catch (e) { setStatusMsg(`Error: ${e}`) }
    setDeletingVideoId(null)
  }

  const handleDownloadStoredVideo = async (postId, date) => {
    const url = `${API}/admin/social/posts/${postId}/video?download=true`
    const r = await fetch(url, { headers: adminHeaders() })
    if (!r.ok) { setStatusMsg('Download failed — video may have been deleted.'); return }
    const blob = await r.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `starsignal-${date}.mp4`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleUploadAndPost = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadResult(null)
    setUploadMsg('Uploading video and generating caption…')
    try {
      const form = new FormData()
      form.append('file', uploadFile)
      const headers = {
        'x-admin-email':    'contact@starsignal.io',
        'x-admin-password': 'BISCUITLOVE',
      }
      const r = await fetch(`${API}/admin/social/post-custom-video`, { method: 'POST', headers, body: form })
      const d = await r.json()
      if (!r.ok) {
        setUploadMsg(`Failed: ${d.detail ?? JSON.stringify(d)}`)
      } else {
        setUploadResult(d)
        setUploadMsg(`Posted! ${d.permalink}`)
        setUploadFile(null)
        loadPosts()
      }
    } catch (e) {
      setUploadMsg(`Error: ${e}`)
    }
    setUploading(false)
  }

  return (
    <div className="min-h-screen" style={{ background: '#060d18', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <Link to="/admin" className="text-xs" style={{ color: '#94a3b8' }}>← Admin</Link>
          <h1 className="text-2xl font-black mt-2 mb-1" style={{ color: '#f8fafc' }}>Social Content</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>
            Daily Instagram Reel automation · HeyGen twin video · Meta Graph API
          </p>
        </div>

        {/* Status message */}
        {statusMsg && (
          <div className="rounded-lg px-4 py-3 mb-6 text-sm" style={{ background: '#0f1a2e', border: '1px solid #1e3a5f', color: '#93c5fd' }}>
            {statusMsg}
          </div>
        )}

        {/* Settings strip */}
        {settings && (
          <div className="rounded-xl p-4 mb-6 flex flex-wrap gap-6 text-xs"
            style={{ background: '#0b1120', border: '1px solid #1e3a5f' }}>
            <div>
              <span style={{ color: '#475569' }}>Auto-posting</span>
              <div className="font-semibold mt-0.5" style={{ color: settings.auto_post_enabled ? '#34d399' : '#f87171' }}>
                {settings.auto_post_enabled ? '● ENABLED' : '● DISABLED'}
              </div>
            </div>
            <div>
              <span style={{ color: '#475569' }}>Instagram</span>
              <div className="font-semibold mt-0.5" style={{ color: settings.instagram_configured ? '#34d399' : '#f87171' }}>
                {settings.instagram_configured ? '● Configured' : '● Not configured'}
              </div>
            </div>
            <div>
              <span style={{ color: '#475569' }}>HeyGen</span>
              <div className="font-semibold mt-0.5" style={{ color: settings.heygen_configured ? '#34d399' : '#f87171' }}>
                {settings.heygen_configured ? '● Configured' : '● Not configured'}
              </div>
            </div>
            <div>
              <span style={{ color: '#475569' }}>Post time</span>
              <div className="font-semibold mt-0.5" style={{ color: '#e2e8f0' }}>8:00 UTC daily</div>
            </div>
            <div className="ml-auto text-xs self-center" style={{ color: '#475569' }}>
              Set AUTO_POST_ENABLED, HEYGEN_*, INSTAGRAM_* in Railway env vars
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="rounded-xl p-5 mb-6" style={{ background: '#0b1120', border: '1px solid #1e3a5f' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: '#94a3b8' }}>MANUAL CONTROLS</h2>
          <div className="mb-3 relative">
            <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>
              Custom headline <span style={{ color: '#475569', fontWeight: 400 }}>(optional — leave blank to auto-pick)</span>
            </label>
            <div className="flex gap-2">
              <input
                ref={newsInputRef}
                type="text"
                value={forcedHeadline}
                onChange={e => { setForcedHeadline(e.target.value); setShowSuggestions(false) }}
                onKeyDown={async e => { if (e.key === 'Enter') { e.preventDefault(); await handleNewsSearch() } }}
                placeholder="Type keywords and click Search…"
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ background: '#0d1f35', border: '1px solid #1e3a5f', color: '#e2e8f0', outline: 'none' }}
              />
              <button
                onClick={handleNewsSearch}
                disabled={loadingSuggestions}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ background: '#0c1e38', border: '1px solid #1e4976', color: '#93c5fd', whiteSpace: 'nowrap', opacity: loadingSuggestions ? 0.6 : 1 }}
              >
                {loadingSuggestions ? 'Searching…' : 'Search'}
              </button>
            </div>
            {showSuggestions && newsSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden" style={{ background: '#0b1120', border: '1px solid #1e3a5f' }}>
                {newsSuggestions.map((item, i) => (
                  <button
                    key={i}
                    onMouseDown={() => {
                      setForcedHeadline(item.title)
                      setShowSuggestions(false)
                      setNewsSuggestions([])
                    }}
                    className="w-full text-left px-3 py-2 text-sm"
                    style={{ color: '#e2e8f0', borderTop: i > 0 ? '1px solid #1e3a5f' : 'none', background: 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#0d1f35'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>{item.title}</span>
                    <span className="ml-2 text-xs" style={{ color: '#475569' }}>{item.source}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              onClick={handleGeneratePreview}
              loading={generating} label="Generate Preview" loadingLabel="Generating…"
              color="#0c1e38" textColor="#93c5fd" border="#1e4976"
            />
            <ActionButton
              onClick={handlePostPreview}
              loading={posting} disabled={!preview?.post}
              label="Post Preview to Instagram, Facebook & YouTube" loadingLabel="Posting…"
              color="#052e1a" textColor="#34d399" border="#10b981"
            />
            <ActionButton
              onClick={handleSkipToday}
              loading={skipping} label="Skip Today" loadingLabel="Skipping…"
              color="#1a1a2e" textColor="#94a3b8" border="#334155"
            />
            <ActionButton
              onClick={handleRunNow}
              loading={running} label="Run Full Job Now" loadingLabel="Running…"
              color="#1c1208" textColor="#fbbf24" border="#78350f"
            />
          </div>
        </div>



        {/* Upload your own video */}
        <div className="rounded-xl p-5 mb-6" style={{ background: '#0b1120', border: '1px solid #1e3a5f' }}>
          <h2 className="text-sm font-bold mb-1" style={{ color: '#94a3b8' }}>POST YOUR OWN VIDEO</h2>
          <p className="text-xs mb-4" style={{ color: '#475569' }}>
            Upload a video you recorded. A caption with today's news + astrology tags is generated automatically and posted to Instagram, Facebook & YouTube.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer"
              style={{ background: '#0c1e38', border: '1px solid #1e4976', color: '#93c5fd' }}>
              {uploadFile ? uploadFile.name : 'Choose Video…'}
              <input type="file" accept="video/*" className="hidden"
                onChange={e => { setUploadFile(e.target.files[0] ?? null); setUploadResult(null); setUploadMsg('') }} />
            </label>

            <ActionButton
              onClick={handleUploadAndPost}
              loading={uploading}
              disabled={!uploadFile}
              label="Post to Instagram, Facebook & YouTube"
              loadingLabel="Uploading & Posting…"
              color="#052e1a" textColor="#34d399" border="#10b981"
            />

            {uploadFile && !uploading && (
              <button onClick={() => { setUploadFile(null); setUploadResult(null); setUploadMsg('') }}
                className="text-xs" style={{ color: '#64748b' }}>
                Clear
              </button>
            )}
          </div>

          {uploadMsg && (
            <div className="mt-3 rounded-lg px-3 py-2 text-sm"
              style={{ background: '#060d18', border: '1px solid #1e3a5f', color: uploadResult?.posted ? '#34d399' : '#93c5fd' }}>
              {uploadMsg}
            </div>
          )}

          {uploadResult?.caption && (
            <div className="mt-3">
              <div className="text-xs mb-1" style={{ color: '#475569' }}>GENERATED CAPTION</div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: '#94a3b8' }}>{uploadResult.caption}</p>
            </div>
          )}
        </div>

        {/* Preview result */}
        {preview?.post && (
          <div className="rounded-xl p-5 mb-6" style={{ background: '#0b1120', border: '1px solid #10b981' }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: '#34d399' }}>PREVIEW READY</h2>

            {/* Video + Thumbnail side by side */}
            <div className="flex flex-wrap gap-5 mb-4">
              {preview.post.media_url && (
                <div>
                  <div className="text-xs mb-1" style={{ color: '#475569' }}>
                    {preview.content_type === 'video' ? 'VIDEO' : 'IMAGE'}
                  </div>
                  {preview.content_type === 'video'
                    ? <>
                        <video src={preview.post.media_url} controls className="rounded-lg" style={{ maxWidth: 280 }} />
                        <button
                          onClick={async () => {
                            const res = await fetch(`${API}/admin/social/download-video?url=${encodeURIComponent(preview.post.media_url)}`, { headers: adminHeaders() })
                            const blob = await res.blob()
                            const a = document.createElement('a')
                            a.href = URL.createObjectURL(blob)
                            a.download = 'starsignal-preview.mp4'
                            a.click()
                            URL.revokeObjectURL(a.href)
                          }}
                          className="inline-block mt-2 text-xs px-3 py-1 rounded"
                          style={{ background: '#1e3a5f', color: '#7dd3fc' }}
                        >
                          ↓ Download video
                        </button>
                      </>
                    : <img src={preview.post.media_url} alt="preview" className="rounded-lg" style={{ maxWidth: 280 }} />
                  }
                </div>
              )}

              {/* Thumbnail preview */}
              <div>
                <div className="text-xs mb-1" style={{ color: '#475569' }}>THUMBNAIL (cover image)</div>
                {preview.thumbnail_url
                  ? <img
                      src={`${preview.thumbnail_url.split('?')[0]}?_k=${thumbKey}`}
                      alt="thumbnail"
                      className="rounded-lg"
                      style={{ maxWidth: 160, border: '1px solid #1e3a5f' }}
                    />
                  : <div className="rounded-lg flex items-center justify-center text-xs"
                      style={{ width: 160, height: 285, background: '#0c1e38', border: '1px solid #1e3a5f', color: '#475569' }}>
                      No thumbnail
                    </div>
                }
                <button
                  onClick={handleRegenThumbnail}
                  disabled={regenThumb}
                  className="mt-2 text-xs px-3 py-1 rounded block"
                  style={{ background: '#1a1a2e', border: '1px solid #334155', color: regenThumb ? '#475569' : '#94a3b8', cursor: regenThumb ? 'default' : 'pointer' }}
                >
                  {regenThumb ? 'Regenerating…' : '↻ Regenerate thumbnail'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm">
              {preview.news_headline && (
                <div>
                  <div className="text-xs mb-1" style={{ color: '#475569' }}>NEWS HEADLINE</div>
                  <p style={{ color: '#93c5fd' }}>{preview.news_headline}</p>
                </div>
              )}
              <div>
                <div className="text-xs mb-1" style={{ color: '#475569' }}>SCRIPT</div>
                <p style={{ color: '#cbd5e1' }}>{preview.post.script}</p>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: '#475569' }}>CAPTION</div>
                <p style={{ color: '#cbd5e1' }}>{preview.post.caption}</p>
              </div>
            </div>
          </div>
        )}

        {/* Post history */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#0b1120', border: '1px solid #1e3a5f' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1e3a5f' }}>
            <h2 className="text-sm font-bold" style={{ color: '#94a3b8' }}>POST HISTORY</h2>
            <button onClick={loadPosts} className="text-xs" style={{ color: '#6366f1' }}>Refresh</button>
          </div>

          {loadingPosts ? (
            <div className="p-6 text-sm text-center" style={{ color: '#475569' }}>Loading…</div>
          ) : posts.length === 0 ? (
            <div className="p-6 text-sm text-center" style={{ color: '#475569' }}>No posts yet.</div>
          ) : (
            posts.map(post => {
              const isOpen = expanded === post.id
              return (
                <div key={post.id} style={{ borderBottom: '1px solid #1e2d45' }}>
                  <div className="px-5 py-3 flex flex-wrap items-center gap-3 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : post.id)}>
                    <span className="text-sm font-mono" style={{ color: '#e2e8f0', minWidth: 100 }}>{post.date}</span>
                    <StatusBadge status={post.status} />
                    <span className="text-xs" style={{ color: '#475569' }}>
                      {post.content_type === 'video' ? '🎬 Video' : '🖼 Image'}
                    </span>
                    {post.instagram_url && (
                      <a href={post.instagram_url} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-xs" style={{ color: '#6366f1', textDecoration: 'underline' }}>
                        View on Instagram →
                      </a>
                    )}
                    <span className="ml-auto text-xs" style={{ color: '#334155' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-4 flex flex-col gap-3" style={{ borderTop: '1px solid #1e2d45', paddingTop: 12 }}>

                      {/* Thumbnail + video side by side */}
                      <div className="flex flex-wrap gap-4">
                        {post.thumbnail_url && (
                          <div>
                            <div className="text-xs mb-1" style={{ color: '#475569' }}>THUMBNAIL</div>
                            <img
                              src={`${post.thumbnail_url}?email=contact%40starsignal.io&password=BISCUITLOVE`}
                              alt="thumbnail"
                              className="rounded-lg"
                              style={{ maxWidth: 120, border: '1px solid #1e3a5f' }}
                            />
                          </div>
                        )}
                        {post.public_url && (
                          <div>
                            <div className="text-xs mb-1" style={{ color: '#475569' }}>MEDIA</div>
                            {post.content_type === 'video'
                              ? <video src={post.public_url} controls className="rounded-lg" style={{ maxWidth: 240 }} />
                              : <img src={post.public_url} alt="post" className="rounded-lg" style={{ maxWidth: 240 }} />
                            }
                          </div>
                        )}
                      </div>

                      {/* Stored video actions */}
                      {post.content_type === 'video' && (
                        <div className="flex flex-wrap items-center gap-2">
                          {post.has_stored_video
                            ? <>
                                <button
                                  onClick={() => handleDownloadStoredVideo(post.id, post.date)}
                                  className="text-xs px-3 py-1 rounded"
                                  style={{ background: '#0c1e38', border: '1px solid #1e4976', color: '#7dd3fc' }}
                                >
                                  ↓ Download stored video
                                </button>
                                {deletingVideoId === post.id
                                  ? <span className="text-xs" style={{ color: '#f87171' }}>Deleting…</span>
                                  : <button
                                      onClick={() => handleDeleteVideo(post.id)}
                                      className="text-xs px-3 py-1 rounded"
                                      style={{ background: '#2d0a0a', border: '1px solid #7f1d1d', color: '#f87171' }}
                                    >
                                      Delete video file
                                    </button>
                                }
                              </>
                            : <span className="text-xs" style={{ color: '#334155' }}>No stored video</span>
                          }
                        </div>
                      )}

                      {post.news_headline && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: '#475569' }}>NEWS HEADLINE</div>
                          <p className="text-sm" style={{ color: '#93c5fd' }}>{post.news_headline}</p>
                        </div>
                      )}
                      {post.script_text && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: '#475569' }}>SCRIPT</div>
                          <p className="text-sm" style={{ color: '#cbd5e1' }}>{post.script_text}</p>
                        </div>
                      )}
                      {post.caption && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: '#475569' }}>CAPTION</div>
                          <p className="text-sm" style={{ color: '#94a3b8' }}>{post.caption}</p>
                        </div>
                      )}
                      {post.error_message && (
                        <div className="text-xs rounded p-2" style={{ background: '#2d0a0a', color: '#f87171' }}>
                          Error: {post.error_message}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-xs" style={{ color: '#334155' }}>
                          Created: {new Date(post.created_at).toLocaleString()}
                          {post.posted_at && ` · Posted: ${new Date(post.posted_at).toLocaleString()}`}
                        </div>
                        {post.status === 'posted' && (
                          deletingId === post.id
                            ? <span className="text-xs" style={{ color: '#f87171' }}>Removing…</span>
                            : confirmDeleteId === post.id
                              ? <span className="flex items-center gap-2">
                                  <span className="text-xs" style={{ color: '#94a3b8' }}>Remove from dashboard?</span>
                                  <button onClick={() => handleDeletePost(post.id)}
                                    className="text-xs rounded px-2 py-1"
                                    style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444' }}>
                                    Yes, remove
                                  </button>
                                  <button onClick={() => setConfirmDeleteId(null)}
                                    className="text-xs rounded px-2 py-1"
                                    style={{ background: '#1e2d45', color: '#94a3b8', border: '1px solid #334155' }}>
                                    Cancel
                                  </button>
                                </span>
                              : <button onClick={() => setConfirmDeleteId(post.id)}
                                  className="text-xs rounded px-2 py-1"
                                  style={{ background: '#2d0a0a', color: '#f87171', border: '1px solid #7f1d1d' }}>
                                  Deleted from Instagram
                                </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}
