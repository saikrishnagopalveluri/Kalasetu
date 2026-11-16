'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGE_NAMES } from '@/lib/languages'
import { STORY_CATEGORIES } from '@/lib/storyCategories'

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

// Module-level, not component state: dedupes identical (story, language)
// translate requests across remounts, React's dev double-effect, and repeat
// visits to /community within the same tab — without this, a page of N
// non-English stories can fire far more than N requests and trip the
// per-minute rate limit in lib/rateLimit.ts, silently leaving some titles
// untranslated (the 429 is swallowed and there's no retry).
const titleTranslationCache = new Map<string, Promise<{ title: string; content?: string } | null>>()

function fetchTranslatedTitle(storyId: string, language: string) {
  const key = `${storyId}:${language}`
  let pending = titleTranslationCache.get(key)
  if (!pending) {
    pending = fetch('/api/story-translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId, language }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    titleTranslationCache.set(key, pending)
  }
  return pending
}

export default function CommunityListView({ stories }: { stories: StorySummary[] }) {
  const { t, language } = useLanguage()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  // A viewer should never have to open a story to find out what it's about —
  // so list titles are translated into the viewer's own site language up
  // front, the same as the detail page's content. Keyed by story id AND the
  // language it was translated into, so switching the site language twice
  // doesn't show a stale translation from the previous language.
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, { language: string; title: string }>>({})

  useEffect(() => {
    const toTranslate = stories.filter((s) => s.language !== language && translatedTitles[s.id]?.language !== language)
    if (toTranslate.length === 0) return
    let cancelled = false
    toTranslate.forEach((s) => {
      fetchTranslatedTitle(s.id, language).then((data) => {
        if (!cancelled && data?.title) {
          setTranslatedTitles((prev) => ({ ...prev, [s.id]: { language, title: data.title } }))
        }
      })
    })
    return () => { cancelled = true }
    // Intentionally omits translatedTitles: this effect reads it once to
    // decide what's missing, and re-adding it to deps would refire on every
    // fetch result and loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, stories])

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

      <Link href="/community/new" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ks-indigo)', color: '#fff',
        borderRadius: 999, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, textDecoration: 'none', marginBottom: 20,
      }}>
        {t('community.writeStory')} <span aria-hidden="true">→</span>
      </Link>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 22 }}>
        <CategoryChip label={t('community.allCategories')} active={activeCategory === null} onClick={() => setActiveCategory(null)} />
        {STORY_CATEGORIES.map((c) => (
          <CategoryChip key={c.value} label={t(c.key)} active={activeCategory === c.value} onClick={() => setActiveCategory(c.value)} />
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
            const displayTitle = s.language === language
              ? s.title
              : (translatedTitles[s.id]?.language === language ? translatedTitles[s.id].title : s.title)
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
                  {t(STORY_CATEGORIES.find((c) => c.value === s.category)?.key ?? 'community.category.craftStory')}
                </span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ks-earth)', marginBottom: 6 }}>
                  {displayTitle}
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
