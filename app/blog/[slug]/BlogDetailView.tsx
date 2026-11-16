'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LANGUAGES } from '@/lib/languages'
import { useLanguage } from '@/lib/LanguageProvider'
import { BLOG_AUTHOR } from '@/lib/blogAuthor'

export type Blog = { slug: string; title: string; content: string; category: string; image_url: string | null; image_credit?: string | null }

// Receives the post already fetched server-side (see page.tsx) so the full
// English article is present in the initial HTML for crawlers. This
// component only adds the interactive per-language translation switch.
export default function BlogDetailView({ post }: { post: Blog }) {
  const { t, language: uiLanguage } = useLanguage()
  const [language, setLanguage] = useState<typeof LANGUAGES[number]['id']>(uiLanguage)
  const [translated, setTranslated] = useState<{ title: string; content: string } | null>(null)
  const [translating, setTranslating] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

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
    //
    // A 20s abort rather than letting this hang indefinitely — under real
    // provider rate limiting this call was taking minutes or never
    // resolving, and the English article underneath (see render below) is
    // always a better outcome than an unbounded wait.
    setTranslating(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    try {
      const res = await fetch('/api/blog-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: post.slug, language: id }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const result = await res.json()
      setTranslated({ title: result.title, content: result.content })
    } catch (err) {
      console.error('Blog detail translation failed:', err)
      setTranslated(null) // fall back to English rather than show broken output
    } finally {
      clearTimeout(timeout)
      setTranslating(false)
    }
  }

  const displayTitle = translated?.title ?? post.title
  const displayContent = translated?.content ?? post.content

  return (
    <div>
      <Link href="/blog" style={{ fontSize: 12.5, color: 'var(--ks-indigo)', textDecoration: 'none', fontWeight: 600 }}>
        <span aria-hidden="true">← </span>{t('blog.backToAll')}
      </Link>

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

      {/* The article body sits on a solid card rather than directly on the
          page's woven-texture background — that pattern is subtle enough
          behind short UI labels elsewhere, but reading several paragraphs
          of body text directly on it was genuinely hard to read. */}
      <div style={{
        background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 16,
        padding: '24px 22px', boxShadow: '0 2px 10px rgba(19,42,69,0.06)',
      }}>
        {/* The English article (from server-rendered props) always shows —
            translating never hides it. A stuck or slow translation call
            (very possible right now under real provider rate limits) used
            to blank out the whole article, title and byline included, for
            as long as the fetch was pending. */}
        {translating && (
          <p style={{ fontSize: 12.5, color: 'var(--ks-muted)', marginBottom: 10 }}>{t('blog.translating')}</p>
        )}
        <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(21px, 5vw, 26px)', color: 'var(--ks-earth)', lineHeight: 1.3, marginBottom: 6 }}>
              {displayTitle}
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--ks-muted)', marginBottom: 14 }}>{t('blog.by')} {BLOG_AUTHOR}</p>
            <div className="ks-zari-band" style={{ width: 64, borderRadius: 3, marginBottom: 22 }} />
            {post.image_url && (
              <div style={{ marginBottom: 22 }}>
                <img
                  src={post.image_url}
                  alt={displayTitle}
                  loading="lazy"
                  style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 14, background: 'var(--ks-border)', display: 'block' }}
                />
                {post.image_credit && (
                  <p style={{ fontSize: 10.5, color: 'var(--ks-muted)', marginTop: 6, textAlign: 'right' }}>{post.image_credit}</p>
                )}
              </div>
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

              const isHighlight = lines.length > 0 && lines.every((l) => l.startsWith('> '))
              if (isHighlight) {
                return (
                  <div key={i} style={{
                    background: 'rgba(212,160,23,0.12)', borderLeft: '3px solid var(--ks-turmeric)',
                    borderRadius: 8, padding: '12px 16px', margin: '18px 0',
                    fontSize: 14, lineHeight: 1.7, color: 'var(--ks-earth)', fontStyle: 'italic',
                  }}>
                    {lines.map((l) => l.slice(2)).join(' ')}
                  </div>
                )
              }

              const isFaqPair = lines.length >= 2 && lines[0].startsWith('Q: ') && lines[1].startsWith('A: ')
              if (isFaqPair) {
                const isOpen = openFaq === i
                return (
                  <div key={i} style={{ borderBottom: '1px solid var(--ks-border)', marginBottom: 6 }}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                        padding: '12px 0', fontSize: 14.5, lineHeight: 1.7, color: 'var(--ks-earth)', fontWeight: 700,
                      }}
                    >
                      {lines[0].slice(3)}
                      <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--ks-clay)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>▾</span>
                    </button>
                    {isOpen && (
                      <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ks-muted)', margin: '0 0 14px' }}>
                        {[lines[1].slice(3), ...lines.slice(2)].join(' ')}
                      </p>
                    )}
                  </div>
                )
              }

              return (
                <p key={i} style={{ fontSize: 14.5, lineHeight: 1.8, color: 'var(--ks-earth)', marginBottom: 16 }}>
                  {para}
                </p>
              )
            })}
        </>
      </div>
    </div>
  )
}
