'use client'

import { useLanguage } from '@/lib/LanguageProvider'

// First thing a keyboard or screen-reader user reaches: jumps past the
// header straight to the page content. Hidden until it has focus.
export default function SkipLink() {
  const { t } = useLanguage()
  return (
    <a href="#main-content" className="ks-skip-link">
      {t('common.skipToContent')}
    </a>
  )
}
