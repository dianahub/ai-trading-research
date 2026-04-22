import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
function headers() {
  return { 'x-admin-email': 'ss-staging-bypass-2026', 'x-admin-password': '', 'Content-Type': 'application/json' }
}

export default function AdminCommissions() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editCode, setEditCode] = useState({})
  const [saving, setSaving] = useState({})
  const [calcMsg, setCalcMsg] = useState('')

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/admin/commissions`, { headers: headers() })
      if (r.ok) setData(await r.json())
    } finally { setLoading(false) }
  }

  async function markPaid(payoutId) {
    await fetch(`${API}/admin/commissions/payouts/${payoutId}/paid`, { method: 'PATCH', headers: headers() })
    refresh()
  }

  async function calculateMonthly() {
    setCalcMsg('Calculating…')
    await fetch(`${API}/admin/commissions/calculate-monthly`, { method: 'POST', headers: headers() })
    setCalcMsg('Done!')
    setTimeout(() => setCalcMsg(''), 3000)
    refresh()
  }

  async function saveCode(partnerId) {
    const { code, active } = editCode[partnerId] || {}
    setSaving(s => ({ ...s, [partnerId]: true }))
    try {
      await fetch(`${API}/admin/commissions/partner/${partnerId}/discount-code`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ discount_code: code, discount_code_active: active }),
      })
      setEditCode(c => { const n = { ...c }; delete n[partnerId]; return n })
      refresh()
    } finally {
      setSaving(s => ({ ...s, [partnerId]: false }))
    }
  }

  if (loading && !data) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#060a14' }}><p style={{ color: '#64748b' }}>Loading…</p></div>

  const { summary, payout_queue, partner_leaderboard } = data || {}

  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/admin" className="text-xs mb-2 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Admin</Link>
            <h1 className="text-2xl font-black" style={{ color: '#f1f5f9' }}>Commissions</h1>
          </div>
          <div className="flex items-center gap-3">
            {calcMsg && <span className="text-xs" style={{ color: '#06b6d4' }}>{calcMsg}</span>}
            <button onClick={calculateMonthly}
              className="px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
              Run Monthly Calc
            </button>
            <button onClick={refresh} disabled={loading}
              className="px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#94a3b8', cursor: 'pointer' }}>
              Refresh
            </button>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              ['Owed this month', `$${summary.total_owed_this_month.toFixed(2)}`],
              ['Paid out all time', `$${summary.total_paid_all_time.toFixed(2)}`],
              ['Monthly recurring', `$${summary.monthly_recurring_liability.toFixed(2)}`],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl p-5" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
                <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>{label}</div>
                <div className="text-2xl font-black" style={{ color: '#06b6d4' }}>{val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Payout queue */}
        {payout_queue?.length > 0 && (
          <div className="rounded-xl p-5 mb-8" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#94a3b8' }}>Payout Queue</h2>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: '#64748b' }}>
                  <th className="text-left pb-2">Partner</th>
                  <th className="text-right pb-2">Month</th>
                  <th className="text-right pb-2">Amount</th>
                  <th className="text-right pb-2">Method</th>
                  <th className="text-right pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {payout_queue.map(p => (
                  <tr key={p.payout_id} style={{ borderTop: '1px solid #1e2d45' }}>
                    <td className="py-2" style={{ color: '#e2e8f0' }}>{p.partner_name}</td>
                    <td className="py-2 text-right" style={{ color: '#94a3b8' }}>{p.month}</td>
                    <td className="py-2 text-right font-semibold" style={{ color: '#f1f5f9' }}>${p.amount.toFixed(2)}</td>
                    <td className="py-2 text-right" style={{ color: '#94a3b8' }}>{p.payout_method}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => markPaid(p.payout_id)}
                        className="px-3 py-1 rounded text-xs font-semibold"
                        style={{ background: '#14532d', color: '#86efac', border: 'none', cursor: 'pointer' }}>
                        Mark Paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Partner leaderboard */}
        {partner_leaderboard?.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#94a3b8' }}>Partners</h2>
            <div className="flex flex-col gap-4">
              {partner_leaderboard.map(p => {
                const editing = editCode[p.id]
                return (
                  <div key={p.id} className="rounded-lg p-4" style={{ background: '#060a14', border: '1px solid #1e2d45' }}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>{p.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                          {p.referral_click_count} clicks · {p.total_referrals} signups
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: '#06b6d4' }}>${p.total_earned.toFixed(2)} total</div>
                        <div className="text-xs" style={{ color: '#64748b' }}>${p.monthly_commission.toFixed(2)}/mo</div>
                      </div>
                    </div>

                    {/* Discount code row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs" style={{ color: '#94a3b8' }}>Code:</span>
                      {editing ? (
                        <>
                          <input
                            value={editing.code}
                            onChange={e => setEditCode(c => ({ ...c, [p.id]: { ...c[p.id], code: e.target.value.toUpperCase() } }))}
                            className="px-2 py-1 rounded text-xs font-mono uppercase"
                            style={{ background: '#0f1a2e', border: '1px solid #1e2d45', color: '#e2e8f0', width: 100 }}
                            maxLength={20}
                          />
                          <label className="flex items-center gap-1 text-xs" style={{ color: '#94a3b8' }}>
                            <input type="checkbox" checked={editing.active}
                              onChange={e => setEditCode(c => ({ ...c, [p.id]: { ...c[p.id], active: e.target.checked } }))} />
                            Active
                          </label>
                          <button onClick={() => saveCode(p.id)} disabled={saving[p.id]}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: '#14532d', color: '#86efac', border: 'none', cursor: 'pointer' }}>
                            {saving[p.id] ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setEditCode(c => { const n = { ...c }; delete n[p.id]; return n })}
                            className="px-2 py-1 rounded text-xs"
                            style={{ background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 rounded font-mono text-xs font-bold"
                            style={{ background: '#1e2d45', color: p.discount_code_active ? '#f1f5f9' : '#64748b' }}>
                            {p.discount_code || '—'}
                          </span>
                          {p.discount_code && (
                            <span className="text-xs" style={{ color: '#64748b' }}>
                              {p.discount_code_uses} uses · {p.discount_code_active ? 'active' : 'inactive'}
                            </span>
                          )}
                          <button onClick={() => setEditCode(c => ({ ...c, [p.id]: { code: p.discount_code || '', active: p.discount_code_active } }))}
                            className="px-2 py-1 rounded text-xs"
                            style={{ background: '#1e2d45', color: '#94a3b8', border: 'none', cursor: 'pointer' }}>
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {partner_leaderboard?.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: '#94a3b8' }}>
            No partners with status "partner" found yet.
          </div>
        )}
      </div>
    </div>
  )
}
