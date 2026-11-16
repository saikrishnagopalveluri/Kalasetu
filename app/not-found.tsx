'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/LanguageProvider'

export default function NotFound() {
  const { t } = useLanguage()

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', padding: '0 20px' }}>
      <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 12 }}>🧵</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 6vw, 30px)', color: 'var(--ks-earth)', marginBottom: 10 }}>
        {t('notFound.title')}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ks-muted)', lineHeight: 1.6, marginBottom: 26 }}>
        {t('notFound.subtitle')}
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block', background: 'var(--ks-indigo)', color: '#fff',
          borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600,
          fontFamily: 'var(--font-body)', textDecoration: 'none',
        }}
      >
        {t('common.backHome')}
      </Link>
    </div>
  )
}
