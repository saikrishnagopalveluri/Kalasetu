'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGE_NAMES } from '@/lib/languages'

export type StorySummary = {
  id: string
  slug: string
  title: string
  category: string
  language: string
  likes_count: number
  rating_sum: number
  rating_count: number
  reading_time_minutes: number
  published_at: string
  author_id: string
  author_name: string | null
  author_photo_url: string | null
}

const CATEGORIES = [
  'My Craft Story', 'How I Make My Products', 'My Village / Tradition', 'Materials & Techniques',
  'Festival Stories', 'Behind the Product', 'My Business Journey', 'Tips for Other Artisans',
  'Traditional Craft Knowledge',
]

export default function CommunityListView({ stories }: { stories: StorySummary[] }) {
  const { t } = useLanguage()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = activeCategory ? stories.filter((s) => s.category === activeCategory) : stories

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('community.title')}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', marginBottom: 14, lineHeight: 1.6, maxWidth: 520 }}>
        {t('community.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 18 }} />

      <a href="/community/new" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ks-indigo)', color: '#fff',
        borderRadius: 999, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, textDecoration: 'none', marginBottom: 20,
      }}>
        {t('community.writeStory')} <span aria-hidden="true">→</span>
      </a>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 22 }}>
        <CategoryChip label={t('community.allCategories')} active={activeCategory === null} onClick={() => setActiveCategory(null)} />
        {CATEGORIES.map((c) => (
          <CategoryChip key={c} label={c} active={activeCategory === c} onClick={() => setActiveCategory(c)} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="ks-lattice" style={{
          backgroundColor: 'var(--ks-ivory)', border: '1px solid var(--ks-border)',
          borderRadius: 12, padding: '28px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>{t('community.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((s) => {
            const avgRating = s.rating_count > 0 ? (s.rating_sum / s.rating_count).toFixed(1) : null
            return (
              <a key={s.id} href={`/community/${s.slug}`} style={{
                display: 'block', background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)',
                boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderLeft: '3px solid var(--ks-clay)',
                borderRadius: 12, padding: '16px 18px', textDecoration: 'none',
              }}>
                <span style={{
                  display: 'inline-block', fontSize: 10, fontWeight: 700, color: 'var(--ks-clay)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                }}>
                  {s.category}
                </span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ks-earth)', marginBottom: 6 }}>
                  {s.title}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ks-muted)', flexWrap: 'wrap' }}>
                  <span>{s.author_name ?? t('community.anArtisan')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{s.reading_time_minutes} {t('community.minRead')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{LANGUAGE_NAMES[s.language] ?? s.language}</span>
                  {avgRating && (<><span aria-hidden="true">·</span><span>★ {avgRating}</span></>)}
                  <span aria-hidden="true">·</span>
                  <span>❤ {s.likes_count}</span>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{
      background: active ? 'var(--ks-indigo)' : '#fff', color: active ? '#fff' : 'var(--ks-earth)',
      border: `1px solid ${active ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
      borderRadius: 999, padding: '7px 13px', fontSize: 12, fontWeight: 500,
      fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 34,
    }}>
      {label}
    </button>
  )
}
