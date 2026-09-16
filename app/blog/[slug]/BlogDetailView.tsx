'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LANGUAGES } from '@/lib/languages'
import { useLanguage } from '@/lib/LanguageProvider'

export type Blog = { slug: string; title: string; content: string; category: string; image_url: string | null }

// Receives the post already fetched server-side (see page.tsx) so the full
// English article is present in the initial HTML for crawlers. This
// component only adds the interactive per-language translation switch.
export default function BlogDetailView({ post }: { post: Blog }) {
  const { t, language: uiLanguage } = useLanguage()
  const [language, setLanguage] = useState<typeof LANGUAGES[number]['id']>(uiLanguage)
  const [translated, setTranslated] = useState<{ title: string; content: string } | null>(null)
  const [translating, setTranslating] = useState(false)

  // Depends on uiLanguage (not just mount) so switching the site-wide
  // language selector while already reading a post re-translates it
  // immediately, matching how the blog list page already behaves — this
  // previously only captured the language once at mount and never reacted
  // to a later switch.
  useEffect(() => {
    handleLanguageChange(uiLanguage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiLanguage])

  async function handleLanguageChange(id: typeof language) {
    setLanguage(id)
    if (id === 'en') { setTranslated(null); return }

    const { data: cached } = await supabase!
      .from('blog_translations')
      .select('title, content')
      .eq('blog_slug', post.slug)
      .eq('language', id)
      .maybeSingle()
    if (cached?.content) { setTranslated({ title: cached.title, content: cached.content }); return }

    // Public, unauthenticated endpoint — the old path went through /api/ai,
    // which requires login and silently failed for every logged-out reader
    // once /blog itself became public.
    setTranslating(true)
    try {
      const res = await fetch('/api/blog-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: post.slug, language: id }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const result = await res.json()
      setTranslated({ title: result.title, content: result.content })
    } catch (err) {
      console.error('Blog detail translation failed:', err)
      setTranslated(null) // fall back to English rather than show broken output
    } finally {
      setTranslating(false)
    }
  }

  const displayTitle = translated?.title ?? post.title
  const displayContent = translated?.content ?? post.content

  return (
    <div>
      <a href="/blog" style={{ fontSize: 12.5, color: 'var(--ks-indigo)', textDecoration: 'none', fontWeight: 600 }}>
        <span aria-hidden="true">← </span>{t('blog.backToAll')}
      </a>

      {post.category && (
        <span style={{
          display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--ks-clay)',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 18,
        }}>
          {post.category}
        </span>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 20px' }}>
        <span style={{ fontSize: 12, color: 'var(--ks-muted)' }}>🌐</span>
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value as typeof language)}
          style={{
            background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 8,
            padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-body)',
            color: 'var(--ks-earth)', width: 'auto', minWidth: 200,
          }}
        >
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label} ({l.name})</option>)}
        </select>
      </label>

      {translating ? (
        <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>{t('blog.translating')}</p>
      ) : (
        <>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(21px, 5vw, 26px)', color: 'var(--ks-earth)', lineHeight: 1.3, marginBottom: 6 }}>
            {displayTitle}
          </h1>
          <div className="ks-zari-band" style={{ width: 64, borderRadius: 3, marginBottom: 22 }} />
          {post.image_url && (
            <img
              src={post.image_url}
              alt={displayTitle}
              loading="lazy"
              style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 14, marginBottom: 22, background: 'var(--ks-border)' }}
            />
          )}
          {displayContent.split('\n\n').map((para, i) => {
            if (para.startsWith('## ')) {
              return (
                <h2 key={i} style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ks-earth)', margin: '26px 0 10px' }}>
                  {para.slice(3)}
                </h2>
              )
            }
            const lines = para.split('\n').map((l) => l.trim()).filter(Boolean)
            const isList = lines.length > 1 && lines.every((l) => l.startsWith('- '))
            if (isList) {
              return (
                <ul key={i} style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14.5, lineHeight: 1.8, color: 'var(--ks-earth)' }}>
                  {lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}
                </ul>
              )
            }
            return (
              <p key={i} style={{ fontSize: 14.5, lineHeight: 1.8, color: 'var(--ks-earth)', marginBottom: 16 }}>
                {para}
              </p>
            )
          })}
        </>
      )}
    </div>
  )
}
