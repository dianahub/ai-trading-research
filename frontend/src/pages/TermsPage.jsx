import { Link } from 'react-router-dom'

function PageLayout({ title, children }) {
  return (
    <div style={{ background: '#070b16', minHeight: '100vh', color: '#e2e8f0' }}>
      <header style={{ background: '#0a0e1a', borderBottom: '1px solid #1e2d45' }}
        className="sticky top-0 z-50 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <span className="text-sm font-bold tracking-widest text-white">Starsignal.io</span>
          </Link>
          <Link to="/" className="text-xs hover:underline" style={{ color: '#64748b' }}>← Back to app</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-8" style={{ color: '#f1f5f9' }}>{title}</h1>
        <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
          {children}
        </div>
      </main>

      <footer className="mt-16 px-6 py-8" style={{ borderTop: '1px solid #1e2d45', background: '#0a0e1a' }}>
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <span className="text-xs" style={{ color: '#475569' }}>© 2026 <a href="https://dianacastillo.zo.space/futurotek/" target="_blank" rel="noopener noreferrer" style={{ color: '#475569', textDecoration: 'underline' }}>Futurotek LLC</a>. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="text-xs hover:underline" style={{ color: '#64748b' }}>Terms of Service</Link>
            <Link to="/privacy" className="text-xs hover:underline" style={{ color: '#64748b' }}>Privacy Policy</Link>
            <Link to="/contact" className="text-xs hover:underline" style={{ color: '#64748b' }}>Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function TermsPage() {
  return (
    <PageLayout title="Terms of Service">
      <p style={{ color: '#64748b' }}>Effective date: January 1, 2026</p>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>1. Acceptance of Terms</h2>
        <p>By accessing or using Star Signal ("the Service"), operated by Futurotek LLC, you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>2. Description of Service</h2>
        <p>Star Signal is an informational research platform that aggregates market data, technical analysis, and astrological insights for educational purposes. The Service does not provide personalized investment advice.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>3. No Financial Advice</h2>
        <p>All content on Star Signal — including astrological signals, technical indicators, price data, and AI-generated analysis — is for informational and educational purposes only. Nothing on this platform constitutes financial, investment, legal, or tax advice. You should consult a qualified financial advisor before making any investment decisions.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>4. Investment Risk</h2>
        <p>Cryptocurrency and financial markets carry significant risk. Past performance does not guarantee future results. You may lose some or all of your invested capital. Futurotek LLC is not liable for any financial losses arising from your use of this Service.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>5. Intellectual Property</h2>
        <p>All content, branding, and software on Star Signal are the property of Futurotek LLC or its licensors. You may not reproduce, distribute, or create derivative works without prior written permission.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>6. Limitation of Liability</h2>
        <p>To the fullest extent permitted by law, Futurotek LLC shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of or inability to use the Service.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>7. Changes to Terms</h2>
        <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>8. Contact</h2>
        <p>Questions about these Terms? <Link to="/contact" className="hover:underline" style={{ color: '#64748b' }}>Contact us</Link>.</p>
      </section>
    </PageLayout>
  )
}
