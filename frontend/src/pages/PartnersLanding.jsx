import { Link } from 'react-router-dom'

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    highlight: false,
    badge: null,
    perks: [
      'Feed included in the Starsignal network',
      'AI extraction of your market insights',
      'Listed as a source with link back to your site',
      'Reach traders on stock & crypto platforms',
    ],
    cta: 'Apply Free',
    ctaStyle: { background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b' },
  },
  {
    name: 'Verified',
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
    cta: 'Apply as Verified',
    ctaStyle: { background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff' },
  },
  {
    name: 'Featured',
    price: '$149',
    period: '/month',
    highlight: false,
    badge: null,
    perks: [
      'Everything in Verified',
      'Pinned placement at top of all feeds',
      'Included in AI-generated market summaries',
      'Co-marketing on our social channels',
      'Dedicated profile page on starsignal.io',
    ],
    cta: 'Apply as Featured',
    ctaStyle: { background: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: '1px solid #3730a3', color: '#a5b4fc' },
  },
]

const FAQS = [
  {
    q: 'Do I need a financial license?',
    a: 'No. We handle all disclaimers and compliance framing. Your insights are served with clear educational and entertainment disclaimers. We never present astrological forecasts as regulated financial advice.',
  },
  {
    q: 'What kind of content qualifies?',
    a: 'Financial astrology, mundane astrology, market timing, planetary cycle analysis, geopolitical forecasts, and sector outlooks. Content should be forward-looking and reference specific market topics (crypto, gold, oil, stocks, banking, currencies).',
  },
  {
    q: 'How do I get paid / what do I get?',
    a: 'Free tier partners get exposure and backlinks. Paid tiers give you enhanced placement, branding, and analytics. We're building toward direct revenue sharing for high-traffic partners — that's coming in a future update.',
  },
  {
    q: 'How does the RSS feed work?',
    a: 'You submit your existing RSS feed URL. Our system fetches it every 6 hours, runs it through AI to extract structured market insights, and distributes those insights to our network. Your original content and links are always preserved.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, absolutely. Paid subscriptions can be cancelled at any time from your partner dashboard — no long-term commitment required. Your feed stays in the network on the Free tier after cancellation.',
  },
]

export default function PartnersLanding() {
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
              <div className="text-xs" style={{ color: '#475569' }}>AI Astro Trading</div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/partners/apply"
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff', textDecoration: 'none' }}>
              Apply to Join
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{ background: '#0f1a2e', border: '1px solid #1e3a5f', color: '#06b6d4' }}>
          ♄ Now accepting partner applications
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6" style={{ color: '#f1f5f9', lineHeight: 1.1 }}>
          Get Your Financial Astrology Insights<br />
          <span style={{ background: 'linear-gradient(135deg, #06b6d4, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            in Front of Traders Worldwide
          </span>
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10" style={{ color: '#94a3b8', lineHeight: 1.7 }}>
          Join our network of astrologers whose insights are distributed to stock and crypto trading platforms as structured market intelligence — automatically, every 6 hours.
        </p>
        <Link to="/partners/apply"
          className="inline-block px-8 py-4 rounded-xl text-base font-bold transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff', textDecoration: 'none' }}>
          Apply to Join →
        </Link>
        <p className="text-sm mt-4" style={{ color: '#475569' }}>Free tier available · No financial license required</p>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: '#f1f5f9' }}>How It Works</h2>
          <p className="text-sm" style={{ color: '#64748b' }}>Three steps from application to global distribution</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Submit Your Feed', desc: 'Share your RSS feed URL and a brief application. We support any standard RSS or Atom feed.' },
            { step: '02', title: 'We Review & Verify', desc: 'Our team reviews your content within 48 hours to ensure it meets our standards for financial astrology insights.' },
            { step: '03', title: 'Automatic Distribution', desc: 'Your insights are AI-extracted every 6 hours and served to traders and fintech platforms in structured JSON format.' },
          ].map(item => (
            <div key={item.step} className="p-6 rounded-xl relative" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
              <div className="text-5xl font-black mb-4" style={{ color: '#1e2d45' }}>{item.step}</div>
              <h3 className="text-base font-semibold mb-2" style={{ color: '#f1f5f9' }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-10" style={{ borderTop: '1px solid #1e2d45', borderBottom: '1px solid #1e2d45' }}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: '4+',    label: 'Partner Astrologers' },
            { value: '6h',    label: 'Ingestion Cycle' },
            { value: '100+',  label: 'Insights in Feed' },
            { value: 'Live',  label: 'Always Current' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-black mb-1" style={{ color: '#06b6d4' }}>{s.value}</div>
              <div className="text-xs" style={{ color: '#475569' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: '#f1f5f9' }}>Choose Your Tier</h2>
          <p className="text-sm" style={{ color: '#64748b' }}>Start free. Upgrade for more reach and branding.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map(tier => (
            <div key={tier.name} className="rounded-xl p-6 flex flex-col relative"
              style={{
                background: '#0f1a2e',
                border: `1px solid ${tier.highlight ? '#3b82f6' : '#1e2d45'}`,
                boxShadow: tier.highlight ? '0 0 40px #3b82f620' : 'none',
              }}>
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff' }}>
                  {tier.badge}
                </div>
              )}
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>
                {tier.name}
              </div>
              <div className="mb-1">
                <span className="text-4xl font-black" style={{ color: '#f1f5f9' }}>{tier.price}</span>
                <span className="text-sm ml-1" style={{ color: '#64748b' }}>{tier.period}</span>
              </div>
              <div className="h-px my-4" style={{ background: '#1e2d45' }} />
              <ul className="space-y-3 flex-1 mb-6">
                {tier.perks.map(p => (
                  <li key={p} className="flex items-start gap-2 text-sm" style={{ color: '#94a3b8' }}>
                    <span style={{ color: '#06b6d4', flexShrink: 0 }}>✓</span>
                    {p}
                  </li>
                ))}
              </ul>
              <Link to="/partners/apply"
                className="block text-center py-3 rounded-lg font-semibold text-sm transition-all hover:brightness-110"
                style={{ ...tier.ctaStyle, textDecoration: 'none' }}>
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof placeholder */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="rounded-xl p-8 text-center" style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
          <div className="text-4xl mb-3">🌟</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#f1f5f9' }}>
            Join our founding partner cohort
          </h3>
          <p className="text-sm max-w-md mx-auto" style={{ color: '#64748b' }}>
            We're in early access. Founding partners get grandfathered pricing and input on the roadmap. Apply now while spots are limited.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center" style={{ color: '#f1f5f9' }}>
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {FAQS.map(faq => (
            <details key={faq.q} className="rounded-xl group"
              style={{ background: '#0f1a2e', border: '1px solid #1e2d45' }}>
              <summary className="px-5 py-4 text-sm font-medium cursor-pointer list-none flex items-center justify-between"
                style={{ color: '#e2e8f0' }}>
                {faq.q}
                <span className="ml-4 text-xs" style={{ color: '#475569' }}>▾</span>
              </summary>
              <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4" style={{ color: '#f1f5f9' }}>
          Ready to reach traders worldwide?
        </h2>
        <p className="text-sm mb-8" style={{ color: '#64748b' }}>
          Applications are reviewed within 48 hours. Free tier available with no commitment.
        </p>
        <Link to="/partners/apply"
          className="inline-block px-8 py-4 rounded-xl text-base font-bold transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', color: '#fff', textDecoration: 'none' }}>
          Apply to Join →
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8" style={{ borderTop: '1px solid #1e2d45', background: '#0a0e1a' }}>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs" style={{ color: '#475569' }}>
            © 2026 Futurotek LLC. All rights reserved.
          </span>
          <div className="flex items-center gap-4 text-xs" style={{ color: '#475569' }}>
            <Link to="/terms"   style={{ color: '#475569', textDecoration: 'none' }}>Terms</Link>
            <Link to="/privacy" style={{ color: '#475569', textDecoration: 'none' }}>Privacy</Link>
            <Link to="/contact" style={{ color: '#475569', textDecoration: 'none' }}>Contact</Link>
            <Link to="/partners/dashboard" style={{ color: '#475569', textDecoration: 'none' }}>Partner Login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
