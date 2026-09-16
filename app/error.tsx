'use client'

import { useEffect } from 'react'

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled app error:', error)
  }, [error])

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', padding: '0 20px' }}>
      <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 6vw, 30px)', color: 'var(--ks-earth)', marginBottom: 10 }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ks-muted)', lineHeight: 1.6, marginBottom: 26 }}>
        This wasn&apos;t your fault. Try again, or head back to the homepage.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => reset()}
          style={{
            background: 'var(--ks-indigo)', color: '#fff', border: 'none', cursor: 'pointer',
            borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600,
            fontFamily: 'var(--font-body)',
          }}
        >
          Try again
        </button>
        <a
          href="/"
          style={{
            display: 'inline-block', background: '#fff', color: 'var(--ks-indigo)',
            border: '1px solid var(--ks-indigo)', borderRadius: 10, padding: '12px 24px',
            fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', textDecoration: 'none',
          }}
        >
          Back to home
        </a>
      </div>
    </div>
  )
}
