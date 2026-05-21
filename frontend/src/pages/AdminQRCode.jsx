import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function adminHeaders() {
  return { 'x-admin-email': 'contact@starsignal.io', 'x-admin-password': 'BISCUITLOVE' }
}

const QR_URL = `${API}/admin/qr-code?` + new URLSearchParams(Object.entries(adminHeaders()).reduce((a, [k,v]) => ({...a}), {}))

export default function AdminQRCode() {
  const imgUrl = `${API}/admin/qr-code`

  function download() {
    const a = document.createElement('a')
    a.href = imgUrl
    a.download = 'starsignal_qr.png'
    // Fetch with auth headers then blob-download
    fetch(imgUrl, { headers: adminHeaders() })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        a.href = url
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
  }

  return (
    <div className="min-h-screen flex flex-col items-center" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="w-full max-w-lg px-4 py-10">
        <Link to="/admin" className="text-xs mb-6 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>
        <h1 className="text-2xl font-black mb-1" style={{ color: '#f1f5f9' }}>QR Code</h1>
        <p className="text-sm mb-8" style={{ color: '#94a3b8' }}>Scan to visit starsignal.io — print, share, or add to presentations.</p>

        <div className="rounded-2xl p-8 flex flex-col items-center gap-6" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
          <QRImage url={imgUrl} />
          <p className="text-sm" style={{ color: '#6366f1' }}>starsignal.io</p>
          <button
            onClick={download}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: '#6366f1', color: '#fff' }}
          >
            Download PNG
          </button>
        </div>
      </div>
    </div>
  )
}

function QRImage({ url }) {
  const [src, setSrc] = React.useState(null)
  const [err, setErr]  = React.useState(false)

  React.useEffect(() => {
    fetch(url, { headers: { 'x-admin-email': 'contact@starsignal.io', 'x-admin-password': 'BISCUITLOVE' } })
      .then(r => r.blob())
      .then(b => setSrc(URL.createObjectURL(b)))
      .catch(() => setErr(true))
  }, [url])

  if (err) return <p style={{ color: '#f87171' }}>Failed to load QR code</p>
  if (!src) return <p style={{ color: '#64748b' }}>Loading…</p>
  return <img src={src} alt="starsignal.io QR code" className="rounded-xl" style={{ maxWidth: 320, width: '100%' }} />
}

// Need React in scope for the QRImage component
import React from 'react'
