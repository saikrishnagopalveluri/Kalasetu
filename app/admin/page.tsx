'use client'

import RequireAdmin from '@/components/RequireAdmin'
import { BRAND } from '@/lib/brand'

function AdminHubInner() {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ks-earth)', marginBottom: 4 }}>
        Admin
      </h1>
      <p style={{ fontSize: 13, color: 'var(--ks-muted)', marginBottom: 24 }}>
        Two portals: artisan and content management, and analytics.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <a href="/admin/operations" style={{ ...cardStyle, borderTop: '3px solid var(--ks-clay)' }}>
          <div style={iconWrapStyle}>👥</div>
          <div style={cardTitleStyle}>Artisans &amp; Content</div>
          <div style={cardDescStyle}>Manage users, subscription tiers, blog posts, and schemes/opportunities.</div>
          <div style={cardLinkStyle}>Open <span aria-hidden="true">→</span></div>
        </a>
        <a href="/admin/analytics" style={{ ...cardStyle, borderTop: '3px solid var(--ks-jade)' }}>
          <div style={iconWrapStyle}>📊</div>
          <div style={cardTitleStyle}>Analytics &amp; Revenue</div>
          <div style={cardDescStyle}>Usage stats, active artisans, subscription tier breakdown.</div>
          <div style={cardLinkStyle}>Open <span aria-hidden="true">→</span></div>
        </a>
        <a href="/admin/saathi" style={{ ...cardStyle, borderTop: '3px solid var(--ks-indigo)' }}>
          <div style={iconWrapStyle}>🤝</div>
          <div style={cardTitleStyle}>{BRAND.name} Saathi</div>
          <div style={cardDescStyle}>Referrals, ₹100 rewards, KalaPoints issued/redeemed, and flagged referral activity.</div>
          <div style={cardLinkStyle}>Open <span aria-hidden="true">→</span></div>
        </a>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  display: 'block', background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)',
  borderRadius: 14, padding: '20px 20px 18px', textDecoration: 'none',
  boxShadow: '0 1px 2px rgba(19,42,69,0.05)',
}

const iconWrapStyle: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 12, background: 'var(--ks-linen)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 22, marginBottom: 12,
}

const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ks-earth)', marginBottom: 6,
}

const cardDescStyle: React.CSSProperties = {
  fontSize: 12.5, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 14,
}

const cardLinkStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: 'var(--ks-indigo)',
}

export default function AdminHubPage() {
  return (
    <RequireAdmin>
      <AdminHubInner />
    </RequireAdmin>
  )
}
