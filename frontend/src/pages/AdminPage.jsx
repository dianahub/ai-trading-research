import { Link } from 'react-router-dom'

const PAGES = [
  {
    path:  '/admin/pending-users',
    title: 'Pending Users',
    desc:  'Review and approve beta access applications.',
    icon:  '👤',
  },
  {
    path:  '/admin/users',
    title: 'Users',
    desc:  'View all users and change their tier.',
    icon:  '🧑‍💻',
  },
  {
    path:  '/admin/partners',
    title: 'Partners',
    desc:  'Manage astrologer partner applications, approvals, tiers, and RSS feeds.',
    icon:  '🤝',
  },
  {
    path:  '/admin/commissions',
    title: 'Commissions',
    desc:  'Partner referral commissions, payout queue, discount codes, and earnings.',
    icon:  '$',
  },
  {
    path:  '/admin/astrologers',
    title: 'Astrologer Contacts',
    desc:  'Contact info for astrologers whose feeds are used in the API.',
    icon:  '✦',
  },
  {
    path:  '/admin/free-signups',
    title: 'Free API Signups',
    desc:  'Review, approve, or reject free API key requests.',
    icon:  '🔑',
  },
  {
    path:  '/admin/outreach',
    title: 'Outreach',
    desc:  'Track outreach campaigns, leads, and partner messaging.',
    icon:  '📣',
  },
  {
    path:  '/admin/config',
    title: 'Site Config',
    desc:  'Toggle beta open/closed and other site-wide settings without redeploying.',
    icon:  '⚙',
  },
  {
    path:  '/admin/errors',
    title: 'Error Log',
    desc:  'View all backend errors — path, status code, error type, and full traceback.',
    icon:  '🔴',
  },
  {
    path:  '/admin/contacts',
    title: 'Contact Messages',
    desc:  'Messages submitted via the contact form.',
    icon:  '✉',
  },
  {
    path:  '/admin/feedback',
    title: 'Beta Feedback',
    desc:  'Feedback submissions from beta testers with ratings.',
    icon:  '⭐',
  },
]

export default function AdminPage() {
  return (
    <div className="min-h-screen" style={{ background: '#060a14', color: '#e2e8f0' }}>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-xs mb-8 inline-block" style={{ color: '#94a3b8', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-black mb-2" style={{ color: '#f1f5f9' }}>Admin</h1>
        <p className="text-sm mb-10" style={{ color: '#94a3b8' }}>Starsignal.io admin tools</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PAGES.map(p => (
            <Link
              key={p.path}
              to={p.path}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="rounded-xl p-6 h-full transition-all"
                style={{ background: '#0b1120', border: '1px solid #1e2d45' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#06b6d4')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2d45')}
              >
                <div className="text-2xl mb-3">{p.icon}</div>
                <div className="font-bold text-base mb-1" style={{ color: '#f1f5f9' }}>{p.title}</div>
                <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{p.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
