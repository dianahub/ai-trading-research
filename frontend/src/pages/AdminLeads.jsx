import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function headers() {
  return { 'x-admin-email': 'contact@starsignal.io', 'x-admin-password': 'BISCUITLOVE', 'Content-Type': 'application/json' }
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const EMPTY_FORM = { name: '', email: '', phone: '', date_contacted: '', notes: '' }

function LeadModal({ lead, onClose, onSaved }) {
  const [form, setForm] = useState(lead ? {
    name:           lead.name,
    email:          lead.email,
    phone:          lead.phone || '',
    date_contacted: lead.date_contacted ? lead.date_contacted.slice(0, 10) : '',
    notes:          lead.notes || '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const url    = lead ? `${API}/admin/leads/${lead.id}` : `${API}/admin/leads`
    const method = lead ? 'PATCH' : 'POST'
    const r = await fetch(url, { method, headers: headers(), body: JSON.stringify(form) })
    if (r.ok) { onSaved(); onClose() }
    else {
      const j = await r.json().catch(() => ({}))
      setError(j.detail || 'Failed to save lead')
    }
    setSaving(false)
  }

  const field = (label, key, type = 'text') => (
    <div>
      <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded px-3 py-2 text-sm outline-none"
        style={{ background: '#060a14', border: '1px solid #1e2d45', color: '#e2e8f0' }}
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-xl p-6 w-full max-w-md" style={{ background: '#0b1120', border: '1px solid #1e2d45' }}>
        <h2 className="font-bold text-lg mb-5" style={{ color: '#f1f5f9' }}>{lead ? 'Edit Lead' : 'Add Lead'}</h2>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {field('Name *', 'name')}
          {field('Email *', 'email', 'email')}
          {field('Phone', 'phone', 'tel')}
          {field('Date Contacted', 'date_contacted', 'date')}
          <div>
            <label className="block text-xs mb-1" style={{ color: '#94a3b8' }}>Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full rounded px-3 py-2 text-sm outline-none resize-none"
              style={{ background: '#060a14', border: '1px solid #1e2d45', color: '#e2e8f0' }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
          <div className="flex gap-3 justify-end mt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ background: '#1e2d45', color: '#94a3b8' }}>Cancel</button>
            <button type="submit" disabled={saving || !form.name || !form.email} className="px-4 py-2 rounded text-sm font-semibold" style={{ background: '#6366f1', color: '#fff', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminLeads() {
  const [leads, setLeads]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)   // null | 'add' | lead object
  const [converting, setConverting] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast]       = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch(`${API}/admin/leads`, { headers: headers() })
    if (r.ok) setLeads(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function convertLead(lead) {
    if (!confirm(`Convert ${lead.name} (${lead.email}) to a user account?`)) return
    setConverting(lead.id)
    const r = await fetch(`${API}/admin/leads/${lead.id}/convert`, { method: 'POST', headers: headers() })
    const j = await r.json().catch(() => ({}))
    if (r.ok) {
      showToast(j.already_existed ? `${lead.email} already had an account — lead marked converted.` : `User account created for ${lead.email}.`)
      load()
    } else {
      showToast(j.detail || 'Conversion failed')
    }
    setConverting(null)
  }

  async function deleteLead(lead) {
    if (!confirm(`Delete lead ${lead.name}?`)) return
    setDeleting(lead.id)
    await fetch(`${API}/admin/leads/${lead.id}`, { method: 'DELETE', headers: headers() })
    load()
    setDeleting(null)
  }

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-lg"
          style={{ background: '#1e3a2e', border: '1px solid #22c55e', color: '#86efac' }}>
          {toast}
        </div>
      )}

      {modal && (
        <LeadModal
          lead={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { load(); setModal(null) }}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link to="/admin" className="text-xs mb-6 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#f1f5f9' }}>Leads</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setModal('add')}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#6366f1', color: '#fff' }}
          >
            + Add Lead
          </button>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: '#64748b' }}>Loading…</p>
        ) : leads.length === 0 ? (
          <p className="text-sm" style={{ color: '#64748b' }}>No leads yet. Add one with the button above.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {leads.map(lead => (
              <div key={lead.id} className="rounded-xl p-5" style={{ background: '#0b1120', border: `1px solid ${lead.converted ? '#14532d' : '#1e2d45'}` }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" style={{ color: '#f1f5f9' }}>{lead.name}</span>
                      {lead.converted && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#14532d', color: '#86efac' }}>Converted</span>
                      )}
                    </div>
                    <div className="text-sm mt-1" style={{ color: '#64748b' }}>{lead.email}</div>
                    {lead.phone && <div className="text-sm mt-0.5" style={{ color: '#64748b' }}>{lead.phone}</div>}
                    {lead.date_contacted && (
                      <div className="text-xs mt-1" style={{ color: '#475569' }}>Contacted {fmt(lead.date_contacted)}</div>
                    )}
                    {lead.notes && (
                      <p className="text-sm mt-3 leading-relaxed" style={{ color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{lead.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setModal(lead)}
                      className="px-3 py-1.5 rounded text-xs"
                      style={{ background: '#1e2d45', color: '#94a3b8' }}
                    >
                      Edit
                    </button>
                    {!lead.converted && (
                      <button
                        onClick={() => convertLead(lead)}
                        disabled={converting === lead.id}
                        className="px-3 py-1.5 rounded text-xs font-semibold"
                        style={{ background: '#0e3a4a', color: '#06b6d4', opacity: converting === lead.id ? 0.6 : 1 }}
                      >
                        {converting === lead.id ? 'Converting…' : 'Convert to User'}
                      </button>
                    )}
                    <button
                      onClick={() => deleteLead(lead)}
                      disabled={deleting === lead.id}
                      className="px-3 py-1.5 rounded text-xs"
                      style={{ background: '#2d1515', color: '#f87171', opacity: deleting === lead.id ? 0.6 : 1 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
