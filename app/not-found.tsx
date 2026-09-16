import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', padding: '0 20px' }}>
      <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 12 }}>🧵</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 6vw, 30px)', color: 'var(--ks-earth)', marginBottom: 10 }}>
        Page not found
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ks-muted)', lineHeight: 1.6, marginBottom: 26 }}>
        The page you're looking for doesn't exist, or the link may be broken.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block', background: 'var(--ks-indigo)', color: '#fff',
          borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600,
          fontFamily: 'var(--font-body)', textDecoration: 'none',
        }}
      >
        Back to home
      </Link>
    </div>
  )
}
