'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'

type Opportunity = {
  id: string
  type: 'scheme' | 'competition' | 'tradeshow'
  title: string
  description: string
  official_url: string
  deadline: string | null
}

const TYPE_META: Record<string, { emoji: string; labelKey: TranslationKey; accent: string }> = {
  scheme: { emoji: '🏛️', labelKey: 'opportunities.type.scheme', accent: 'var(--ks-indigo)' },
  competition: { emoji: '🏆', labelKey: 'opportunities.type.competition', accent: 'var(--ks-clay)' },
  tradeshow: { emoji: '🎪', labelKey: 'opportunities.type.tradeshow', accent: 'var(--ks-jade)' },
}

function isSoon(deadline: string | null): boolean {
  if (!deadline) return false
  const days = (new Date(deadline).getTime() - Date.now()) / 86400000
  return days >= 0 && days <= 14
}

function OpportunitiesPageInner() {
  const { t } = useLanguage()
  // No backend configured: nothing to load, so start at the empty state.
  const [items, setItems] = useState<Opportunity[] | null>(() => (supabase ? null : []))

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('opportunities')
      .select('id, type, title, description, official_url, deadline')
      .order('deadline', { ascending: true, nullsFirst: false })
      .then(({ data }) => setItems(data ?? []))
  }, [])

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('opportunities.title')}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 16, maxWidth: 520 }}>
        {t('opportunities.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 26 }} />

      {items === null ? (
        <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>{t('opportunities.loading')}</p>
      ) : items.length === 0 ? (
        <div style={{
          background: 'var(--ks-ivory)', border: '1px dashed var(--ks-border)',
          borderRadius: 12, padding: '30px 16px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>{t('opportunities.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((o) => {
            const meta = TYPE_META[o.type]
            const emoji = meta?.emoji ?? '📌'
            const label = meta ? t(meta.labelKey) : o.type
            const accent = meta?.accent ?? 'var(--ks-clay)'
            const urgent = isSoon(o.deadline)
            return (
              <div key={o.id} style={{
                background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)',
                borderLeft: `4px solid ${accent}`,
                borderRadius: 12, padding: '16px 18px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 19 }} aria-hidden="true">{emoji}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: accent,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {label}
                  </span>
                  {o.deadline && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: urgent ? '#fff' : 'var(--ks-muted)',
                      background: urgent ? 'var(--ks-clay)' : 'var(--ks-linen)',
                      borderRadius: 999, padding: '3px 10px', marginLeft: 'auto',
                    }}>
                      {t('opportunities.deadline')} {new Date(o.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, color: 'var(--ks-earth)', marginBottom: 8, lineHeight: 1.3 }}>
                  {o.title}
                </h2>
                <p style={{ fontSize: 13.5, color: 'var(--ks-earth)', lineHeight: 1.6, marginBottom: 14 }}>
                  {o.description}
                </p>
                <a
                  href={o.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--ks-indigo)', color: '#fff',
                    borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    minHeight: 40,
                  }}
                >
                  {t('opportunities.visitSite')} <span aria-hidden="true">↗</span>
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function OpportunitiesPage() {
  return (
    <RequireAuth>
      <OpportunitiesPageInner />
    </RequireAuth>
  )
}
