'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGES } from '@/lib/languages'
import type { TranslationKey } from '@/lib/translations'
import { supabase } from '@/lib/supabase'
import { BRAND } from '@/lib/brand'
import PeacockMark from '@/components/PeacockMark'
import { GondCloud, GondNight, GondScene, skyTimeFor } from '@/components/GondArt'
import { useLocalHour } from '@/lib/useLocalHour'

type BlogPreview = { slug: string; title: string; summary: string; category: string }

const FEATURES: { emoji: string; titleKey: TranslationKey; descKey: TranslationKey; accent: string }[] = [
  { emoji: '📸', titleKey: 'landing.feature.photoshoot.title', descKey: 'landing.feature.photoshoot.desc', accent: '#C4552D' },
  { emoji: '✍️', titleKey: 'landing.feature.content.title', descKey: 'landing.feature.content.desc', accent: '#1F5A57' },
  { emoji: '💰', titleKey: 'landing.feature.pricing.title', descKey: 'landing.feature.pricing.desc', accent: '#B7860F' },
  { emoji: '📋', titleKey: 'landing.feature.catalogue.title', descKey: 'landing.feature.catalogue.desc', accent: '#132A45' },
  { emoji: '🏛️', titleKey: 'landing.feature.schemes.title', descKey: 'landing.feature.schemes.desc', accent: '#A8432A' },
  { emoji: '🤖', titleKey: 'landing.feature.coach.title', descKey: 'landing.feature.coach.desc', accent: '#2F6B4F' },
]

const accent = (c: string) => ({ ['--accent' as string]: c }) as React.CSSProperties

// The landing page is laid out like a Gond painting read top to bottom: a
// sky scene (sun or moon by the local time) with trees and hills, a teal band of ground, the cream
// page, and an evening-sky band with fish-scale water at the foot.
export default function LandingPage() {
  const hour = useLocalHour()
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
      {/* ── Scene: a painted sky that follows the visitor's local time ─ */}
      <GondScene sky={hour === null ? 'night' : skyTimeFor(hour)} className="ks-scene-top ks-pop-in">
        <div className="ks-medallion" style={{
          ...accent('#E0A526'), width: 86, height: 86, margin: '0 auto 22px',
          background: 'var(--ks-paper)', outlineWidth: 2.5, outlineOffset: 5,
          boxShadow: '0 8px 22px rgba(0,0,0,0.3)',
        }}>
          <PeacockMark size={48} />
        </div>
        <p className="ks-eyebrow" style={{ color: 'var(--scene-accent)', fontSize: 12, marginBottom: 12 }}>
          {BRAND.name}
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 5.6vw, 36px)', color: 'var(--scene-ink)', lineHeight: 1.22,
          maxWidth: 560, margin: '0 auto 16px', textShadow: 'var(--scene-ink-shadow)',
        }}>
          {t('landing.heroHeadline')}
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--scene-ink-soft)', maxWidth: 460, margin: '0 auto 26px', lineHeight: 1.65 }}>
          {t('landing.heroSubtitle')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" className="ks-press" style={{
            background: 'var(--ks-turmeric)', color: 'var(--ks-earth)', textDecoration: 'none',
            borderRadius: 999, padding: '14px 30px', fontSize: 14.5, fontWeight: 700,
            boxShadow: '0 8px 20px rgba(212,160,23,0.35)',
          }}>
            {t('landing.getStarted')}
          </Link>
          <Link href="/login" className="ks-press" style={{
            background: 'var(--scene-ghost-bg)', color: 'var(--scene-ink)', textDecoration: 'none',
            border: '1.5px dotted var(--scene-ghost-border)', borderRadius: 999, padding: '13px 28px', fontSize: 14.5, fontWeight: 600,
          }}>
            {t('landing.logIn')}
          </Link>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--scene-ink-soft)', opacity: 0.8, marginTop: 18 }}>
          {t('landing.noCard')}
        </p>
      </GondScene>

      {/* ── Band: teal ground, every language ────────────── */}
      <section className="ks-band ks-band-teal ks-bleed ks-scallop" style={{ marginTop: -1, marginBottom: 34 }}>
        <div className="ks-band-inner" style={{ textAlign: 'center' }}>
          <h2 className="ks-section-title is-center" style={{ fontSize: 17 }}>
            {t('landing.languagePride')}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 620, margin: '0 auto' }}>
            {LANGUAGES.map((l) => (
              <span key={l.id} style={{
                background: 'rgba(244,231,195,0.1)', border: '1px dotted rgba(244,231,195,0.45)', borderRadius: 999,
                padding: '5px 12px', fontSize: 12, color: '#F4E7C3', fontWeight: 500,
              }}>
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Introduction video ───────────────────────────── */}
      {/* No autoplay and preload="none": it carries sound, and a 4 MB file
          shouldn't cost a visitor data before they choose to watch it. Only
          rendered for the brand the video was made for. */}
      {BRAND.introVideo && (
        <section style={{ marginBottom: 36 }}>
          <h2 className="ks-section-title is-center">{t('landing.videoTitle')}</h2>
          <div className="ks-panel" style={{ padding: 10 }}>
            <video
              controls
              playsInline
              preload="none"
              poster={BRAND.introVideo.poster}
              aria-label={t('landing.videoTitle')}
              style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', borderRadius: 10, background: '#132A45', position: 'relative', zIndex: 1 }}
            >
              <source src={BRAND.introVideo.src} type="video/mp4" />
            </video>
          </div>
        </section>
      )}

      {/* ── Who we are / what we are ─────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 30 }}>
        {([
          { heading: 'landing.whoWeAre.heading' as TranslationKey, body: 'landing.whoWeAre.body' as TranslationKey, color: '#C4552D', emoji: '🤝' },
          { heading: 'landing.whatWeAre.heading' as TranslationKey, body: 'landing.whatWeAre.body' as TranslationKey, color: '#1F5A57', emoji: '🧭' },
        ]).map((card) => (
          <div key={card.heading} className="ks-panel" style={{ ...accent(card.color), padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <span className="ks-medallion" style={{ ...accent(card.color), fontSize: 20 }} aria-hidden="true">{card.emoji}</span>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ks-earth)' }}>
                {t(card.heading)}
              </h2>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ks-earth)', lineHeight: 1.75 }}>
              {t(card.body)}
            </p>
          </div>
        ))}
      </section>

      <div className="ks-frieze" style={{ marginBottom: 30 }} />

      {/* ── What it does: painted tiles ──────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 38 }}>
        {FEATURES.map((f) => (
          <div key={f.titleKey} className="ks-tile ks-press" style={{ ...accent(f.accent), padding: '20px 18px' }}>
            <span className="ks-medallion" style={{ ...accent(f.accent), fontSize: 20, marginBottom: 14 }} aria-hidden="true">{f.emoji}</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ks-earth)', marginBottom: 5 }}>
              {t(f.titleKey)}
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--ks-muted)', lineHeight: 1.6 }}>
              {t(f.descKey)}
            </p>
          </div>
        ))}
      </section>

      {/* ── Stories from the blog ────────────────────────── */}
      {/* A real section with real posts: logged-out visitors otherwise had
          no visible path to /blog from this page. */}
      {blogPreview && blogPreview.length > 0 && (
        <section style={{ marginBottom: 38 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 2 }}>
            <h2 className="ks-section-title" style={{ flex: 1, marginBottom: 14 }}>{t('landing.blog.heading')}</h2>
            <Link href="/blog" style={{ fontSize: 12.5, color: 'var(--ks-clay)', fontWeight: 600, textDecoration: 'none', marginBottom: 14, whiteSpace: 'nowrap' }}>
              {t('landing.blog.cta')} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {blogPreview.map((p) => (
              <a key={p.slug} href={`/blog/${p.slug}`} className="ks-panel ks-press" style={{ display: 'block', padding: '18px 18px', textDecoration: 'none' }}>
                {p.category && (
                  <span className="ks-eyebrow" style={{ display: 'inline-block', fontSize: 10, color: 'var(--ks-clay)', marginBottom: 6 }}>
                    {p.category}
                  </span>
                )}
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, color: 'var(--ks-earth)', marginBottom: 5, lineHeight: 1.35 }}>
                  {p.title}
                </h3>
                <p style={{ fontSize: 12.5, color: 'var(--ks-muted)', lineHeight: 1.55 }}>{p.summary}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Band: evening sky over fish-scale water ──────── */}
      <section className="ks-bleed" style={{ marginBottom: -100 }}>
        <div className="ks-band ks-band-rust ks-scallop-top" style={{ textAlign: 'center', padding: '54px 20px 40px', overflow: 'hidden' }}>
          <GondNight className="ks-scene-night" style={{ opacity: 0.8 }} />
          <GondCloud style={{ position: 'absolute', left: 'max(-20px, calc(50% - 470px))', top: 30, width: 'clamp(70px, 14vw, 130px)', opacity: 0.9 }} />
          <GondCloud style={{ position: 'absolute', right: 'max(-20px, calc(50% - 430px))', bottom: 24, width: 'clamp(60px, 11vw, 100px)', opacity: 0.85 }} />
          <div className="ks-band-inner">
            <Link href="/signup" className="ks-press" style={{
              display: 'inline-block', background: 'var(--ks-turmeric)', color: 'var(--ks-earth)', textDecoration: 'none',
              borderRadius: 999, padding: '14px 34px', fontSize: 14.5, fontWeight: 700, marginBottom: 14,
              boxShadow: '0 8px 20px rgba(0,0,0,0.22)',
            }}>
              {t('landing.getStarted')}
            </Link>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>
              {t('landing.footer.tagline')}
            </p>
          </div>
        </div>
        <div className="ks-scales-strip" aria-hidden="true" />
      </section>
    </div>
  )
}
