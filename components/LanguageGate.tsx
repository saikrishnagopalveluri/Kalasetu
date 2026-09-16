'use client'

import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGES } from '@/lib/languages'

export default function LanguageGate() {
  const { showGate, dismissGate, t } = useLanguage()

  if (!showGate) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--ks-earth)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      // justify-content: center here would clip the top of the language grid
      // on any viewport shorter than the content (virtually every phone,
      // once you lay out 23 languages): centered flex content that overflows
      // a scrollable container can't be scrolled up to reveal what's above
      // center in most browsers. Top-aligned + auto vertical margins on the
      // inner card centers it ONLY when it fits, and degrades to normal
      // top-anchored scrolling once it doesn't.
      padding: '24px 24px 40px', overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', margin: 'auto 0' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🌐</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: '#fff', marginBottom: 6 }}>
          {t('gate.title')}
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 26 }}>
          {t('gate.subtitle')}
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8,
        }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => dismissGate(l.id)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, padding: '14px 8px', cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(217,164,65,0.2)' }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{l.label}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>{l.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
