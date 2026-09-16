'use client'

import { useLanguage } from '@/lib/LanguageProvider'

export default function HeaderTagline() {
  const { t } = useLanguage()
  return (
    <div className="ks-header-tagline" style={{ color: 'var(--ks-turmeric)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {t('header.tagline')}
      <style jsx>{`
        @media (max-width: 420px) {
          .ks-header-tagline { display: none; }
        }
      `}</style>
    </div>
  )
}
