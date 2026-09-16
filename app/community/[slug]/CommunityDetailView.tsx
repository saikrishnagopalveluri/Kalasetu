'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGES, LANGUAGE_NAMES } from '@/lib/languages'

export type Story = {
  id: string
  slug: string
  title: string
  content: string
  category: string
  language: string
  reading_time_minutes: number
  likes_count: number
  rating_sum: number
  rating_count: number
  published_at: string
  author_id: string
  author_name: string | null
  author_business_name: string | null
  author_photo_url: string | null
  author_public_slug: string | null
}

export default function CommunityDetailView({ story }: { story: Story }) {
  const { user } = useAuth()
  const { t } = useLanguage()

  const [viewLanguage, setViewLanguage] = useState(story.language)
  const [translated, setTranslated] = useState<{ title: string; content: string } | null>(null)
  const [translating, setTranslating] = useState(false)

  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(story.likes_count)
  const [myRating, setMyRating] = useState<number | null>(null)
  const [ratingSum, setRatingSum] = useState(story.rating_sum)
  const [ratingCount, setRatingCount] = useState(story.rating_count)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!supabase || !user) return
    supabase.from('story_likes').select('user_id').eq('story_id', story.id).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setLiked(!!data))
    supabase.from('story_ratings').select('stars').eq('story_id', story.id).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setMyRating(data?.stars ?? null))
  }, [user, story.id])

  useEffect(() => {
    if (viewLanguage === story.language) { setTranslated(null); return }
    let cancelled = false
    setTranslating(true)
    fetch('/api/story-translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: story.id, language: viewLanguage }),
    }).then((r) => r.ok ? r.json() : null).then((data) => {
      if (!cancelled && data?.title) setTranslated(data)
    }).finally(() => { if (!cancelled) setTranslating(false) })
    return () => { cancelled = true }
  }, [viewLanguage, story.id, story.language])

  async function handleLike() {
    if (!user || !supabase) return
    if (liked) {
      await supabase.from('story_likes').delete().eq('story_id', story.id).eq('user_id', user.id)
      setLiked(false)
      setLikesCount((n) => Math.max(0, n - 1))
    } else {
      await supabase.from('story_likes').insert({ story_id: story.id, user_id: user.id })
      setLiked(true)
      setLikesCount((n) => n + 1)
    }
  }

  async function handleRate(stars: number) {
    if (!user || !supabase) return
    const previous = myRating
    if (previous === null) {
      await supabase.from('story_ratings').insert({ story_id: story.id, user_id: user.id, stars })
      setRatingSum((s) => s + stars)
      setRatingCount((c) => c + 1)
    } else {
      await supabase.from('story_ratings').update({ stars }).eq('story_id', story.id).eq('user_id', user.id)
      setRatingSum((s) => s - previous + stars)
    }
    setMyRating(stars)
  }

  function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: displayTitle, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const displayTitle = translated?.title ?? story.title
  const displayContent = translated?.content ?? story.content
  const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : null

  return (
    <div>
      <span style={{
        display: 'inline-block', fontSize: 10, fontWeight: 700, color: 'var(--ks-clay)',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        {story.category}
      </span>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5.5vw, 30px)', color: 'var(--ks-earth)', marginBottom: 14, lineHeight: 1.2 }}>
        {displayTitle}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        {story.author_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.author_photo_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--ks-linen)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }} aria-hidden="true">👤</div>
        )}
        <div>
          {story.author_public_slug ? (
            <a href={`/a/${story.author_public_slug}`} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ks-earth)', textDecoration: 'none' }}>
              {story.author_business_name ?? story.author_name ?? t('community.anArtisan')}
            </a>
          ) : (
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ks-earth)' }}>{story.author_business_name ?? story.author_name ?? t('community.anArtisan')}</span>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--ks-muted)' }}>
            {story.reading_time_minutes} {t('community.minRead')} · {new Date(story.published_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 22, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginRight: 4 }}>{t('community.viewIn')}</span>
        {[story.language, ...LANGUAGES.filter((l) => l.id !== story.language).map((l) => l.id).slice(0, 4)].map((id) => (
          <button key={id} type="button" onClick={() => setViewLanguage(id)} aria-pressed={viewLanguage === id} style={{
            background: viewLanguage === id ? 'var(--ks-indigo)' : '#fff', color: viewLanguage === id ? '#fff' : 'var(--ks-earth)',
            border: `1px solid ${viewLanguage === id ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
            borderRadius: 999, padding: '5px 11px', fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
          }}>
            {LANGUAGE_NAMES[id] ?? id}
          </button>
        ))}
      </div>

      <div className="ks-frieze" style={{ marginBottom: 22 }} />

      {translating ? (
        <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>{t('common.loading')}</p>
      ) : (
        <div style={{ fontSize: 15, lineHeight: 1.85, color: 'var(--ks-earth)', whiteSpace: 'pre-wrap', marginBottom: 30 }}>
          {displayContent}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 18, borderTop: '1px solid var(--ks-border)' }}>
        <button
          type="button" onClick={handleLike} disabled={!user}
          aria-pressed={liked}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: liked ? 'rgba(196,85,45,0.12)' : '#fff',
            border: '1px solid var(--ks-border)', borderRadius: 999, padding: '9px 16px', fontSize: 13.5, fontWeight: 600,
            color: 'var(--ks-earth)', cursor: user ? 'pointer' : 'default', opacity: user ? 1 : 0.6,
          }}
        >
          <span aria-hidden="true">{liked ? '❤️' : '🤍'}</span> {likesCount}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n} type="button" onClick={() => handleRate(n)} disabled={!user}
              aria-label={`${n} star`}
              style={{ background: 'none', border: 'none', fontSize: 19, cursor: user ? 'pointer' : 'default', padding: 2, color: myRating && n <= myRating ? 'var(--ks-turmeric)' : 'var(--ks-border)' }}
            >
              ★
            </button>
          ))}
          {avgRating && <span style={{ fontSize: 12, color: 'var(--ks-muted)', marginLeft: 4 }}>{avgRating} ({ratingCount})</span>}
        </div>

        <button type="button" onClick={handleShare} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid var(--ks-border)',
          borderRadius: 999, padding: '9px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--ks-earth)', cursor: 'pointer', marginLeft: 'auto',
        }}>
          <span aria-hidden="true">🔗</span> {copied ? t('common.copied') : t('community.share')}
        </button>
      </div>
      {!user && <p style={{ fontSize: 12, color: 'var(--ks-muted)', marginTop: 10 }}>{t('community.loginToInteract')}</p>}
    </div>
  )
}
