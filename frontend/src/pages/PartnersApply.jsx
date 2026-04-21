import { useState } from 'react'
import { Link } from 'react-router-dom'

const ASTRO_URL = import.meta.env.VITE_ASTRO_URL ?? 'https://astro-api-production.up.railway.app'

const ASTROLOGER_TYPES = [
  { value: 'financial_astrology',  label: 'Financial Astrology' },
  { value: 'mundane_astrology',    label: 'Mundane Astrology' },
  { value: 'vedic_jyotish',        label: 'Vedic / Jyotish' },
  { value: 'western_tropical',     label: 'Western / Tropical' },
  { value: 'hellenistic',          label: 'Hellenistic' },
  { value: 'uranian',              label: 'Uranian / Hamburg' },
  { value: 'chinese_bazi',         label: 'Chinese / BaZi' },
  { value: 'other',                label: 'Other' },
]

const TIERS = [
  {
    name: 'Free',
    value: 'free',
    price: '$0',
    period: '/month',
    highlight: false,
    perks: [
      'Feed included in the Starsignal network',
      'AI extraction of your market insights',
      'Listed as a source with link back to your site',
      'Reach traders on stock & crypto platforms',
    ],
  },
  {
    name: 'Verified',
    value: 'verified',
    price: '$49',
    period: '/month',
    highlight: true,
    badge: '✦ Most Popular',
    perks: [
      'Everything in Free',
      '"Verified Astrologer" badge on all your cards',
      'Your name and avatar displayed with insights',
      'Priority placement in the feed',
      'Monthly analytics — impressions & platforms reached',
    ],
  },
  {
    name: 'Featured',
    value: 'featured',
    price: '$149',
    period: '/month',
    highlight: false,
    perks: [
      'Everything in Verified',
      'Pinned placement at top of all feeds',
      'Included in AI-generated market summaries',
      'Co-marketing on our social channels',
      'Dedicated profile page on starsignal.io',
    ],
  },
]

const STEP_LABELS = ['About You', 'Your Content', 'Choose Tier', 'Confirmation']

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: done ? '#06b6d4' : active ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : '#1e2d45',
                  color: done || active ? '#fff' : '#94a3b8',
                }}>
                {done ? '✓' : step}
              </div>
              <span className="text-xs mt-1 hidden md:block" style={{ color: active ? '#06b6d4' : '#94a3b8' }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className="w-12 md:w-20 h-px mx-1 mb-5" style={{ background: done ? '#06b6d4' : '#1e2d45' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function InputField({ label, name, value, onChange, type = 'text', placeholder, required, maxLength, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: '#cbd5e1' }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
        style={{
          background: '#070b16',
          border: '1px solid #1e2d45',
          color: '#e2e8f0',
          caretColor: '#06b6d4',
        }}
        onFocus={e => { e.target.style.borderColor = '#06b6d4' }}
        onBlur={e => { e.target.style.borderColor = '#1e2d45' }}
      />
      {hint && <span className="text-xs" style={{ color: '#94a3b8' }}>{hint}</span>}
    </div>
  )
}

function TextArea({ label, name, value, onChange, placeholder, required, maxLength, rows = 3 }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: '#cbd5e1' }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        rows={rows}
        className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
        style={{
          background: '#070b16',
          border: '1px solid #1e2d45',
          color: '#e2e8f0',
          caretColor: '#06b6d4',
        }}
        onFocus={e => { e.target.style.borderColor = '#06b6d4' }}
        onBlur={e => { e.target.style.borderColor = '#1e2d45' }}
      />
      {maxLength && (
        <span className="text-xs text-right" style={{ color: '#94a3b8' }}>
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  )
}

function SelectField({ label, name, value, onChange, options, required, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: '#cbd5e1' }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
        style={{
          background: '#070b16',
          border: '1px solid #1e2d45',
          color: value ? '#e2e8f0' : '#94a3b8',
          appearance: 'none',
          cursor: 'pointer',
        }}
        onFocus={e => { e.target.style.borderColor = '#06b6d4' }}
        onBlur={e => { e.target.style.borderColor = '#1e2d45' }}
      >
        <option value="" disabled>Select…</option>
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#0f1a2e', color: '#e2e8f0' }}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-xs" style={{ color: '#94a3b8' }}>{hint}</span>}
    </div>
  )
}

export default function PartnersApply() {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    // Step 1
    name: '',
    email: '',
    phone: '',
    website: '',
    astrologerType: '',
    bio: '',
    photoUrl: '',
    twitterUrl: '',
    substackUrl: '',
    youtubeUrl: '',
    // Step 2
    rssUrl: '',
    contentTypes: [],
    publishingYears: '',
    publishFrequency: '',
    // Step 3
    tier: 'free',
  })

  function handle(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function toggleContentType(val) {
    setForm(f => ({
      ...f,
      contentTypes: f.contentTypes.includes(val)
        ? f.contentTypes.filter(v => v !== val)
        : [...f.contentTypes, val],
    }))
  }

  function validateStep1() {
    if (!form.name.trim()) return 'Name is required.'
    if (!form.email.trim() || !form.email.includes('@')) return 'Valid email is required.'
    if (!form.website.trim()) return 'Website is required.'
    if (!form.astrologerType) return 'Please select your type of astrology.'
    if (!form.bio.trim()) return 'Bio is required.'
    return ''
  }

  function validateStep2() {
    if (!form.publishingYears) return 'Publishing experience is required.'
    if (!form.publishFrequency) return 'Publishing frequency is required.'
    return ''
  }

  function nextStep() {
    setError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
    }
    if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }
    }
    setStep(s => s + 1)
  }

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name:             form.name,
        email:            form.email,
        phone:            form.phone,
        website:          form.website,
        bio:              form.bio,
        photoUrl:         form.photoUrl,
        twitterUrl:       form.twitterUrl,
        substackUrl:      form.substackUrl,
        youtubeUrl:       form.youtubeUrl,
        rssUrl:           form.rssUrl,
        contentTypes:     form.astrologerType ? [form.astrologerType] : [],
        publishingYears:  form.publishingYears,
        publishFrequency: form.publishFrequency,
        tier:             form.tier,
      }

      const res = await fetch(`${ASTRO_URL}/api/v1/partners/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Submission failed. Please try again.')
        setSubmitting(false)
        return
      }

      // Paid tier → redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }

      // Free tier → go to confirmation step
      setStep(4)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#070b16', color: '#e2e8f0' }}>
      {/* Nav */}
      <header className="sticky top-0 z-50 px-6 py-4"
        style={{ background: 'rgba(7,11,22,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e2d45' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div>
              <div className="text-sm font-bold tracking-widest text-white">Starsignal.io</div>
              <div className="text-xs" style={{ color: '#94a3b8' }}>AI Astro Trading</div>
            </div>
          </Link>
          <Link to="/partners" className="text-sm" style={{ color: '#94a3b8', textDecoration: 'none' }}>
            ← Back to Partners
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Partner Application</h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>Join our network of financial astrologers</p>
        </div>

        <StepIndicator current={step} />

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm" style={{ background: '#2d1515', border: '1px solid #f87171', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {/* ── Step 1: About You ── */}
        {step === 1 && (
          <div className="rounded-xl p-8" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
            <h2 className="text-lg font-semibold mb-6" style={{ color: '#f1f5f9' }}>About You</h2>
            <div className="flex flex-col gap-5">
              <div className="grid md:grid-cols-2 gap-5">
                <InputField label="Full Name" name="name" value={form.name} onChange={handle} placeholder="Your name" required />
                <InputField label="Email" name="email" value={form.email} onChange={handle} type="email" placeholder="you@example.com" required />
              </div>
              <InputField label="Phone Number" name="phone" value={form.phone} onChange={handle} type="tel" placeholder="+1 (555) 000-0000" />
              <div className="grid md:grid-cols-2 gap-5">
                <InputField label="Website" name="website" value={form.website} onChange={handle} placeholder="https://yoursite.com" required hint="Your main site or blog" />
                <SelectField
                  label="Type of Astrologer"
                  name="astrologerType"
                  value={form.astrologerType}
                  onChange={handle}
                  required
                  options={ASTROLOGER_TYPES}
                />
              </div>
              <TextArea
                label="Short Bio"
                name="bio"
                value={form.bio}
                onChange={handle}
                placeholder="Tell us about your background in financial astrology..."
                required
                maxLength={200}
                rows={3}
              />
              <InputField
                label="Profile Photo URL"
                name="photoUrl"
                value={form.photoUrl}
                onChange={handle}
                placeholder="https://example.com/photo.jpg"
                hint="Optional — shown on Verified/Featured tiers"
              />
              <div>
                <div className="text-sm font-medium mb-3" style={{ color: '#cbd5e1' }}>Social Links <span style={{ color: '#94a3b8' }}>(optional)</span></div>
                <div className="flex flex-col gap-3">
                  <InputField label="Twitter / X" name="twitterUrl" value={form.twitterUrl} onChange={handle} placeholder="https://x.com/yourhandle" />
                  <InputField label="Substack" name="substackUrl" value={form.substackUrl} onChange={handle} placeholder="https://yourname.substack.com" />
                  <InputField label="YouTube" name="youtubeUrl" value={form.youtubeUrl} onChange={handle} placeholder="https://youtube.com/@yourchannel" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Your Content ── */}
        {step === 2 && (
          <div className="rounded-xl p-8" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
            <h2 className="text-lg font-semibold mb-6" style={{ color: '#f1f5f9' }}>Your Content</h2>
            <div className="flex flex-col gap-5">
              <InputField
                label="RSS Feed URL"
                name="rssUrl"
                value={form.rssUrl}
                onChange={handle}
                placeholder="https://yoursite.com/feed.xml"
                hint="Optional — we'll pull your content automatically if provided"
              />
              <SelectField
                label="Years Publishing"
                name="publishingYears"
                value={form.publishingYears}
                onChange={handle}
                required
                options={[
                  { value: 'less_than_1', label: 'Less than 1 year' },
                  { value: '1_to_3', label: '1–3 years' },
                  { value: '3_to_7', label: '3–7 years' },
                  { value: '7_plus', label: '7+ years' },
                ]}
              />
              <SelectField
                label="Publishing Frequency"
                name="publishFrequency"
                value={form.publishFrequency}
                onChange={handle}
                required
                options={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'biweekly', label: 'Bi-weekly' },
                  { value: 'monthly', label: 'Monthly' },
                ]}
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Choose Tier ── */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold mb-6 text-center" style={{ color: '#f1f5f9' }}>Choose Your Tier</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {TIERS.map(tier => {
                const selected = form.tier === tier.value
                return (
                  <button key={tier.value} type="button"
                    onClick={() => setForm(f => ({ ...f, tier: tier.value }))}
                    className="rounded-xl p-5 flex flex-col relative text-left transition-all"
                    style={{
                      background: '#0f1a2e',
                      border: `2px solid ${selected ? '#3b82f6' : tier.highlight ? '#1e3a5f' : '#1e2d45'}`,
                      boxShadow: selected ? '0 0 30px #3b82f630' : 'none',
                      cursor: 'pointer',
                    }}>
                    {tier.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap"
                        style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff' }}>
                        {tier.badge}
                      </div>
                    )}
                    {selected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: '#3b82f6' }}>
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#94a3b8' }}>
                      {tier.name}
                    </div>
                    <div className="mb-3">
                      <span className="text-3xl font-black" style={{ color: '#f1f5f9' }}>{tier.price}</span>
                      <span className="text-xs ml-1" style={{ color: '#94a3b8' }}>{tier.period}</span>
                    </div>
                    <ul className="space-y-2">
                      {tier.perks.map(p => (
                        <li key={p} className="flex items-start gap-1.5 text-xs" style={{ color: '#94a3b8' }}>
                          <span style={{ color: '#06b6d4', flexShrink: 0 }}>✓</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>
            {form.tier !== 'free' && (
              <div className="rounded-lg px-4 py-3 text-xs text-center" style={{ background: '#0f2a1a', border: '1px solid #166534', color: '#86efac' }}>
                You'll be redirected to Stripe to complete payment. Your application goes live immediately after checkout.
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Confirmation ── */}
        {step === 4 && (
          <div className="rounded-xl p-10 text-center" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <span className="text-white text-2xl">✓</span>
            </div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: '#f1f5f9' }}>Application Received</h2>
            <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: '#94a3b8', lineHeight: 1.7 }}>
              Thanks for applying to the Starsignal Partner Network. We'll review your feed within 48 hours and email you at <strong style={{ color: '#e2e8f0' }}>{form.email}</strong>.
            </p>
            <div className="rounded-lg px-4 py-3 text-xs mb-8" style={{ background: '#070b16', border: '1px solid #1e2d45', color: '#94a3b8' }}>
              Founding partners get grandfathered pricing and early input on the roadmap.
            </div>
            <Link to="/partners"
              className="inline-block px-6 py-3 rounded-lg font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff', textDecoration: 'none' }}>
              Back to Partners Page
            </Link>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        {step < 4 && (
          <div className="flex items-center justify-between mt-6">
            {step > 1 ? (
              <button type="button" onClick={() => { setError(''); setStep(s => s - 1) }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8', cursor: 'pointer' }}>
                ← Back
              </button>
            ) : (
              <Link to="/partners" className="px-5 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8', textDecoration: 'none' }}>
                ← Back
              </Link>
            )}

            {step < 3 && (
              <button type="button" onClick={nextStep}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff', cursor: 'pointer' }}>
                Continue →
              </button>
            )}

            {step === 3 && (
              <button type="button" onClick={submit} disabled={submitting}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: submitting ? '#1e2d45' : 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                  color: submitting ? '#94a3b8' : '#fff',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}>
                {submitting ? 'Submitting…' : form.tier === 'free' ? 'Submit Application' : 'Continue to Payment →'}
              </button>
            )}
          </div>
        )}
      </div>

      <footer className="px-6 py-8" style={{ borderTop: '1px solid #1e2d45', background: '#0a0e1a' }}>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs" style={{ color: '#94a3b8' }}>
            © 2026 Futurotek LLC. All rights reserved.
          </span>
          <div className="flex items-center gap-4 text-xs" style={{ color: '#94a3b8' }}>
            <Link to="/terms"   style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms</Link>
            <Link to="/privacy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy</Link>
            <a href="https://www.linkedin.com/company/113175994/" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
