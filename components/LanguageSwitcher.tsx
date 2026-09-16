'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGES } from '@/lib/languages'

// gate.title/gate.subtitle already say the same thing on the first-run
// language gate, reused here rather than adding a duplicate key pair.

const QUICK_LANGUAGES = ['en', 'te', 'hi'] as const

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="ks-lang-switcher" style={{
        display: 'flex', alignItems: 'center', flexShrink: 0, gap: 2,
        background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 2,
        border: '1px solid rgba(255,255,255,0.12)',
      }}>
        {QUICK_LANGUAGES.map((id) => {
          const l = LANGUAGES.find((lang) => lang.id === id)!
          return (
            <button
              key={id}
              onClick={() => setLanguage(id)}
              className="ks-lang-btn"
              style={{
                background: language === id ? 'var(--ks-indigo)' : 'transparent',
                color: language === id ? '#fff' : 'rgba(255,255,255,0.5)',
                border: 'none', borderRadius: 6, padding: '11px 11px', fontFamily: 'var(--font-body)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                minHeight: 40,
              }}
            >
              {l.label}
            </button>
          )
        })}
        <button
          onClick={() => setOpen(true)}
          title={t('languageSwitcher.more')}
          aria-label={t('languageSwitcher.more')}
          className="ks-lang-btn"
          style={{
            background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 6,
            padding: '11px 9px', fontSize: 13, cursor: 'pointer', minHeight: 40,
          }}
        >
          🌐
        </button>
        <style jsx>{`
          /* Shrink the label text on narrow screens, but never the tap
             target itself — that's exactly where mis-taps between adjacent
             language buttons are most likely and costly. */
          @media (max-width: 420px) {
            .ks-lang-btn { padding: 11px 8px !important; font-size: 11px !important; }
          }
        `}</style>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(19,42,69,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--ks-earth)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%',
              maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{t('gate.title')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => { setLanguage(l.id); setOpen(false) }}
                  style={{
                    background: language === l.id ? 'var(--ks-indigo)' : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px 8px',
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{l.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{l.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
