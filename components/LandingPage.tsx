'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGES } from '@/lib/languages'
import type { TranslationKey } from '@/lib/translations'
import { supabase } from '@/lib/supabase'
import { BRAND } from '@/lib/brand'
import PeacockMark from '@/components/PeacockMark'
import FeatherFlourish from '@/components/FeatherFlourish'

type BlogPreview = { slug: string; title: string; summary: string; category: string }

const FEATURES: { emoji: string; titleKey: TranslationKey; descKey: TranslationKey; accent: string }[] = [
  { emoji: '📸', titleKey: 'landing.feature.photoshoot.title', descKey: 'landing.feature.photoshoot.desc', accent: '#C4552D' },
  { emoji: '✍️', titleKey: 'landing.feature.content.title', descKey: 'landing.feature.content.desc', accent: '#0F5B4E' },
  { emoji: '💰', titleKey: 'landing.feature.pricing.title', descKey: 'landing.feature.pricing.desc', accent: '#D4A017' },
  { emoji: '📋', titleKey: 'landing.feature.catalogue.title', descKey: 'landing.feature.catalogue.desc', accent: '#132A45' },
  { emoji: '🏛️', titleKey: 'landing.feature.schemes.title', descKey: 'landing.feature.schemes.desc', accent: '#C4552D' },
  { emoji: '🤖', titleKey: 'landing.feature.coach.title', descKey: 'landing.feature.coach.desc', accent: '#0F5B4E' },
]

function cardHover(accent: string) {
  return {
    onMouseOver: (e: React.MouseEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      el.style.transform = 'translateY(-3px)'
      el.style.boxShadow = `0 10px 26px ${accent}22`
    },
    onMouseOut: (e: React.MouseEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      el.style.transform = ''
      el.style.boxShadow = ''
    },
  }
}

export default function LandingPage() {
  const { t } = useLanguage()
  const [blogPreview, setBlogPreview] = useState<BlogPreview[] | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('blogs')
      .select('slug, title, summary, category')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setBlogPreview(data ?? []))
  }, [])

  return (
    <div>
      {/* Hero */}
      <div
        className="ks-banner-ikat ks-pop-in"
        style={{
          borderRadius: 18,
          padding: 'clamp(30px, 7vw, 44px) clamp(20px, 6vw, 30px)',
          marginBottom: 30,
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <FeatherFlourish style={{
          position: 'absolute', bottom: -10, right: -10, width: 'clamp(140px, 32vw, 220px)', height: 'auto',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
        <div style={{
          width: 120, height: 84, borderRadius: 18, background: '#F9E9D6', margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.18), 0 6px 18px rgba(0,0,0,0.25)',
        }}>
          <PeacockMark size={84} />
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5.4vw, 30px)', color: '#fff', lineHeight: 1.28,
          maxWidth: 500, margin: '0 auto 16px',
        }}>
          {t('landing.heroHeadline')}
        </h1>
        <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.78)', maxWidth: 440, margin: '0 auto 26px', lineHeight: 1.65 }}>
          {t('landing.heroSubtitle')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" style={{
            background: 'var(--ks-turmeric)', color: 'var(--ks-earth)', textDecoration: 'none',
            borderRadius: 10, padding: '14px 28px', fontSize: 14.5, fontWeight: 700,
            boxShadow: '0 8px 20px rgba(212,160,23,0.35)',
          }}>
            {t('landing.getStarted')}
          </Link>
          <Link href="/login" style={{
            background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.32)', borderRadius: 10, padding: '14px 28px', fontSize: 14.5, fontWeight: 600,
          }}>
            {t('landing.logIn')}
          </Link>
        </div>
        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 18, letterSpacing: '0.01em' }}>
          {t('landing.noCard')}
        </p>
        </div>
      </div>

      {/* Introduction video. No autoplay and preload="none": it carries
          sound, and a 4 MB file shouldn't cost a visitor data before they
          choose to watch it. Only rendered for the brand the video was made for. */}
      {BRAND.introVideo && (
        <div style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 4.5vw, 22px)', color: 'var(--ks-earth)',
            textAlign: 'center', marginBottom: 14,
          }}>
            {t('landing.videoTitle')}
          </h2>
          <video
            controls
            playsInline
            preload="none"
            poster={BRAND.introVideo.poster}
            aria-label={t('landing.videoTitle')}
            style={{
              display: 'block', width: '100%', aspectRatio: '16 / 9', borderRadius: 14,
              background: '#132A45', boxShadow: '0 10px 30px rgba(19,42,69,0.22)',
            }}
          >
            <source src={BRAND.introVideo.src} type="video/mp4" />
          </video>
        </div>
      )}

      {/* Language pride */}
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <p style={{
          fontSize: 12, fontWeight: 700, color: 'var(--ks-clay)', marginBottom: 14,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          🌐 {t('landing.languagePride')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 580, margin: '0 auto' }}>
          {LANGUAGES.map((l) => (
            <span key={l.id} style={{
              background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 999,
              padding: '5px 12px', fontSize: 11.5, color: 'var(--ks-earth)', fontWeight: 500,
            }}>
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="ks-frieze" style={{ marginBottom: 30 }} />

      {/* Who we are / What we are */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 34,
      }}>
        {([
          { heading: 'landing.whoWeAre.heading' as TranslationKey, body: 'landing.whoWeAre.body' as TranslationKey, accent: '#C4552D', emoji: '🤝' },
          { heading: 'landing.whatWeAre.heading' as TranslationKey, body: 'landing.whatWeAre.body' as TranslationKey, accent: '#0F5B4E', emoji: '🧭' },
        ]).map((card) => (
          <div
            key={card.heading}
            style={{
              background: 'var(--ks-ivory)', borderRadius: 14, padding: '22px 20px',
              border: '1px solid var(--ks-border)', borderTop: `3px solid ${card.accent}`,
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            }}
            {...cardHover(card.accent)}
          >
            <div style={{ fontSize: 22, marginBottom: 10 }} aria-hidden="true">{card.emoji}</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ks-earth)', marginBottom: 10 }}>
              {t(card.heading)}
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--ks-earth)', lineHeight: 1.75 }}>
              {t(card.body)}
            </p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 34,
      }}>
        {FEATURES.map((f) => (
          <div
            key={f.titleKey}
            style={{
              background: 'var(--ks-linen)', borderRadius: 12, padding: '18px 16px',
              border: '1px solid var(--ks-border)', borderTop: `2px dashed ${f.accent}`,
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            }}
            {...cardHover(f.accent)}
          >
            <div style={{ fontSize: 26, marginBottom: 10 }} aria-hidden="true">{f.emoji}</div>
            <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: 'var(--ks-earth)', marginBottom: 4 }}>
              {t(f.titleKey)}
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ks-muted)', lineHeight: 1.55 }}>
              {t(f.descKey)}
            </p>
          </div>
        ))}
      </div>

      {/* Blog — a real section with real posts, not a link tucked at the
          bottom. Logged-out visitors previously had no visible path to it
          at all from this page, even though /blog itself is public. */}
      {blogPreview && blogPreview.length > 0 && (
        <div style={{ marginBottom: 34 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ks-earth)' }}>
              📚 {t('landing.blog.heading')}
            </h2>
            <Link href="/blog" style={{ fontSize: 12.5, color: 'var(--ks-clay)', fontWeight: 600, textDecoration: 'none' }}>
              {t('landing.blog.cta')} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {blogPreview.map((p) => (
              <a
                key={p.slug}
                href={`/blog/${p.slug}`}
                style={{
                  display: 'block', background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)',
                  borderLeft: '3px solid var(--ks-clay)', borderRadius: 12, padding: '16px 18px',
                  textDecoration: 'none', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(19,42,69,0.10)' }}
                onMouseOut={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
              >
                {p.category && (
                  <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: 'var(--ks-clay)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    {p.category}
                  </span>
                )}
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ks-earth)', marginBottom: 5, lineHeight: 1.35 }}>
                  {p.title}
                </h3>
                <p style={{ fontSize: 12.5, color: 'var(--ks-muted)', lineHeight: 1.55 }}>{p.summary}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Final CTA */}
      <div style={{
        textAlign: 'center', background: 'var(--ks-linen)', borderRadius: 16,
        padding: '32px 24px', marginBottom: 8,
      }}>
        <Link href="/signup" style={{
          display: 'inline-block', background: 'var(--ks-indigo)', color: '#fff', textDecoration: 'none',
          borderRadius: 10, padding: '14px 32px', fontSize: 14.5, fontWeight: 700, marginBottom: 14,
          boxShadow: '0 8px 20px rgba(19,42,69,0.22)',
        }}>
          {t('landing.getStarted')}
        </Link>
        <p style={{ fontSize: 12, color: 'var(--ks-muted)' }}>
          {t('landing.footer.tagline')}
        </p>
      </div>
    </div>
  )
}
