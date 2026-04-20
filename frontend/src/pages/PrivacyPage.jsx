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
            <a href="https://www.linkedin.com/company/113175994/" target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: '#64748b' }}>LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <PageLayout title="Privacy Policy">
      <p style={{ color: '#64748b' }}>Effective date: January 1, 2026</p>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>1. Overview</h2>
        <p>Futurotek LLC ("we", "us", "our") operates Star Signal at Starsignal.io. This Privacy Policy explains how we collect, use, and protect your information when you use our Service.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>2. Information We Collect</h2>
        <p>We collect only the information necessary to provide the Service:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li><strong style={{ color: '#cbd5e1' }}>Usage data:</strong> ticker symbols you search, pages visited, and general interaction patterns.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Technical data:</strong> browser type, IP address, and device information for analytics and security.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Contact information:</strong> if you reach out to us, we collect your name and email address.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>3. How We Use Your Information</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>To operate and improve the Service</li>
          <li>To respond to your inquiries</li>
          <li>To monitor for abuse or security issues</li>
          <li>To comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>4. Data Sharing</h2>
        <p>We do not sell your personal information. We may share data with trusted service providers (such as hosting and analytics providers) strictly to operate the Service. We may disclose information if required by law.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>5. Cookies</h2>
        <p>Star Signal may use cookies or local storage to remember your preferences (such as whether the Astro panel is visible). We do not use tracking cookies for advertising purposes.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>6. Data Retention</h2>
        <p>We retain usage data for as long as necessary to provide the Service and comply with legal obligations. You may request deletion of any personal data we hold about you.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>7. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data. To exercise these rights, please <Link to="/contact" className="hover:underline" style={{ color: '#64748b' }}>contact us</Link>.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>8. Changes to This Policy</h2>
        <p>We may update this Privacy Policy periodically. We will notify users of significant changes by updating the effective date above.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#e2e8f0' }}>9. Contact</h2>
        <p>Questions about this policy? <Link to="/contact" className="hover:underline" style={{ color: '#64748b' }}>Reach out to us</Link>.</p>
      </section>
    </PageLayout>
  )
}
