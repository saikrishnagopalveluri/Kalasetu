'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageProvider'

export type BlogSummary = { slug: string; title: string; summary: string; category: string; created_at: string; image_url: string | null }
type TranslatedFields = { title: string; summary: string }

// Receives posts already fetched server-side (see page.tsx), so the English
// title/summary of every post is present in the initial HTML for crawlers —
// this component only adds the interactive per-UI-language translation swap
// on top, it never re-fetches the post list itself.
export default function BlogListView({ posts }: { posts: BlogSummary[] }) {
  const { t, language } = useLanguage()
  const [translations, setTranslations] = useState<Record<string, TranslatedFields>>({})

  useEffect(() => {
    if (!supabase || posts.length === 0) return
    setTranslations({})
    if (language === 'en') return

    let cancelled = false
    async function loadTranslations() {
      const slugs = posts.map((p) => p.slug)
      const { data: cached } = await supabase!
        .from('blog_translations')
        .select('blog_slug, title, summary')
        .in('blog_slug', slugs)
        .eq('language', language)

      if (cancelled) return
      const found: Record<string, TranslatedFields> = {}
      for (const row of cached ?? []) {
        if (row.summary) found[row.blog_slug] = { title: row.title, summary: row.summary }
      }
      if (Object.keys(found).length > 0) setTranslations((prev) => ({ ...prev, ...found }))

      const missing = posts.filter((p) => !found[p.slug])
      if (missing.length === 0) return

      // Public, unauthenticated endpoint — the old path went through
      // /api/ai, which requires login and silently failed for every
      // logged-out reader once /blog itself became public.
      //
      // Batched rather than all-at-once: firing every missing post's
      // translation simultaneously hit provider rate limits hard (the same
      // issue found in the daily-blog cron) — most requests failed and
      // silently left those posts in English.
      const BATCH_SIZE = 3
      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        if (cancelled) return
        const batch = missing.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map((p) =>
            fetch('/api/blog-translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug: p.slug, language }),
            }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${p.slug}: ${r.status}`))))
              .then((data) => [p.slug, data] as const)
          )
        )
        if (cancelled) return

        const newlyTranslated: Record<string, TranslatedFields> = {}
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const [slug, data] = r.value
            if (data?.title && data?.summary) newlyTranslated[slug] = { title: data.title, summary: data.summary }
          } else {
            console.error('Blog list translation failed:', r.reason)
          }
        }
        if (Object.keys(newlyTranslated).length > 0) setTranslations((prev) => ({ ...prev, ...newlyTranslated }))
        if (i + BATCH_SIZE < missing.length) await new Promise((r) => setTimeout(r, 1200))
      }
    }
    loadTranslations()
    return () => { cancelled = true }
  }, [posts, language])

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('blog.title')}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', marginBottom: 14, lineHeight: 1.6 }}>
        {t('blog.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 26 }} />

      {posts.length === 0 ? (
        <div className="ks-lattice" style={{
          backgroundColor: 'var(--ks-ivory)', border: '1px solid var(--ks-border)',
          borderRadius: 12, padding: '28px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>{t('blog.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map((p) => {
            const tr = translations[p.slug]
            return (
              <a
                key={p.slug}
                href={`/blog/${p.slug}`}
                style={{
                  display: 'block', background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)',
                  borderLeft: '3px solid var(--ks-clay)',
                  borderRadius: 12, padding: '16px 18px', textDecoration: 'none',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseOver={(e) => {
                  const el = e.currentTarget
                  el.style.transform = 'translateY(-2px)'
                  el.style.boxShadow = '0 8px 20px rgba(19,42,69,0.10)'
                }}
                onMouseOut={(e) => {
                  const el = e.currentTarget
                  el.style.transform = ''
                  el.style.boxShadow = '0 2px 8px rgba(19,42,69,0.05)'
                }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      loading="lazy"
                      width={88}
                      height={88}
                      style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10, flexShrink: 0, background: 'var(--ks-border)' }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    {p.category && (
                      <span style={{
                        display: 'inline-block', fontSize: 10, fontWeight: 700, color: 'var(--ks-clay)',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                      }}>
                        {p.category}
                      </span>
                    )}
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ks-earth)', marginBottom: 5 }}>
                      {tr?.title ?? p.title}
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--ks-muted)', lineHeight: 1.55 }}>{tr?.summary ?? p.summary}</p>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
