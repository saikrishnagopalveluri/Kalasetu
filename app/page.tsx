'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import LandingPage from '@/components/LandingPage'
import { useLanguage } from '@/lib/LanguageProvider'
import VoiceAgentBanner from '@/components/VoiceAgentBanner'
import { useAskAI } from '@/lib/AskAIProvider'
import type { TranslationKey } from '@/lib/translations'
import ProductTour from '@/components/ProductTour'
import PeacockMark from '@/components/PeacockMark'
import FeatherFlourish from '@/components/FeatherFlourish'
import {
  IconStudio, IconDesign, IconContent, IconPromote, IconCoach, IconCalculator,
  IconLearn, IconCatalogue, IconOpportunities, IconBlog, IconPricing, IconCheck,
  IconWallet, IconSaathi, IconUpskill,
} from '@/components/CraftIcons'

type QuickAction = { Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; titleKey: TranslationKey; descKey: TranslationKey; href: string; accent: string; isModal?: boolean }

// "Create" actions are what an artisan reaches for daily — shown as a
// compact horizontal-scroll row so ten-plus options don't compete equally
// for attention. "Grow" actions are lower-frequency/informational, shown
// as a calmer vertical list below.
const PRIMARY_ACTIONS: QuickAction[] = [
  { Icon: IconStudio, titleKey: 'action.photoshoot.title', descKey: 'action.photoshoot.desc', href: '/studio', accent: '#C4552D' },
  { Icon: IconDesign, titleKey: 'action.design.title', descKey: 'action.design.desc', href: '/design', accent: '#132A45' },
  { Icon: IconContent, titleKey: 'action.content.title', descKey: 'action.content.desc', href: '/content', accent: '#0F5B4E' },
  { Icon: IconPromote, titleKey: 'action.promote.title', descKey: 'action.promote.desc', href: '/promote', accent: '#D4A017' },
  { Icon: IconCoach, titleKey: 'action.coach.title', descKey: 'action.coach.desc', href: '/coach', accent: '#D4A017', isModal: true },
  { Icon: IconCalculator, titleKey: 'action.calculator.title', descKey: 'action.calculator.desc', href: '/calculator', accent: '#0F5B4E' },
]

const GROW_ACTIONS: QuickAction[] = [
  { Icon: IconCatalogue, titleKey: 'action.catalogue.title', descKey: 'action.catalogue.desc', href: '/catalogue', accent: '#D4A017' },
  { Icon: IconOpportunities, titleKey: 'action.opportunities.title', descKey: 'action.opportunities.desc', href: '/opportunities', accent: '#C4552D' },
  { Icon: IconBlog, titleKey: 'action.blog.title', descKey: 'action.blog.desc', href: '/blog', accent: '#0F5B4E' },
  { Icon: IconLearn, titleKey: 'action.learn.title', descKey: 'action.learn.desc', href: '/learn', accent: '#132A45' },
  { Icon: IconPricing, titleKey: 'action.pricing.title', descKey: 'action.pricing.desc', href: '/pricing', accent: '#D4A017' },
]

const DEMO_RECENT: { emoji: string; labelKey: TranslationKey; productKey: TranslationKey; presetKey: TranslationKey | null; timeKey: TranslationKey; timeN?: number }[] = [
  { emoji: '📸', labelKey: 'home.demo.photoshoot', productKey: 'home.demo.product.jamdani', presetKey: 'studio.preset.studio', timeKey: 'time.hoursAgo', timeN: 2 },
  { emoji: '📢', labelKey: 'home.demo.instagramPost', productKey: 'home.demo.product.kalamkari', presetKey: 'studio.preset.festival', timeKey: 'time.yesterday' },
  { emoji: '✍️', labelKey: 'home.demo.description', productKey: 'home.demo.product.filigree', presetKey: null, timeKey: 'time.daysAgo', timeN: 2 },
]

const CONTENT_TYPE_META: Record<string, { emoji: string; labelKey: TranslationKey }> = {
  description: { emoji: '✍️', labelKey: 'home.contentType.description' },
  caption: { emoji: '📸', labelKey: 'home.contentType.caption' },
  whatsapp: { emoji: '💬', labelKey: 'home.contentType.whatsapp' },
  catalogue: { emoji: '📋', labelKey: 'home.contentType.catalogue' },
}

const DAILY_CONTENT_LIMIT = 20

// Was hardcoded to "Good morning" no matter when someone actually logged in.
// Uses the device's local clock (not a server timestamp), so it's correct
// for whatever timezone the artisan is actually in.
function greetingKey(): TranslationKey {
  const hour = new Date().getHours()
  if (hour < 12) return 'home.greeting'
  if (hour < 17) return 'home.greetingAfternoon'
  return 'home.greetingEvening'
}

function timeAgo(iso: string, t: (key: TranslationKey) => string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return t('time.justNow')
  if (mins < 60) return t(mins === 1 ? 'time.minAgo' : 'time.minsAgo').replace('{n}', String(mins))
  const hours = Math.round(mins / 60)
  if (hours < 24) return t(hours === 1 ? 'time.hourAgo' : 'time.hoursAgo').replace('{n}', String(hours))
  const days = Math.round(hours / 24)
  return days === 1 ? t('time.yesterday') : t('time.daysAgo').replace('{n}', String(days))
}

type RecentRow = {
  id: string
  content_type: string
  product_name: string
  language: string
  content: string
  created_at: string
}

type ActivityStats = {
  productsCount: number
  contentCount: number
  cataloguePublished: boolean
}

function HomePageContent() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const { open: openAskAI } = useAskAI()
  const [recent, setRecent] = useState<RecentRow[] | null>(null)
  const [contentToday, setContentToday] = useState<number | null>(null)
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [selectedRecent, setSelectedRecent] = useState<RecentRow | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [artisansEmpowered, setArtisansEmpowered] = useState<number | null>(null)

  useEffect(() => {
    if (!supabase || !user) return

    supabase
      .from('generated_content')
      .select('id, content_type, product_name, language, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (error) { console.error('Failed to load recent creations:', error.message); return }
        setRecent(data ?? [])
      })

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    supabase
      .from('generated_content')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())
      .then(({ count, error }) => {
        if (error) { console.error('Failed to load content quota:', error.message); return }
        setContentToday(count ?? 0)
      })

    supabase.from('wallet_transactions').select('amount').eq('user_id', user.id)
      .then(({ data }) => setWalletBalance((data ?? []).reduce((sum, tx) => sum + tx.amount, 0)))
    supabase.from('saathi_referrals').select('id', { count: 'exact', head: true })
      .eq('saathi_id', user.id).eq('status', 'REWARD_UNLOCKED')
      .then(({ count }) => setArtisansEmpowered(count ?? 0))
  }, [user])

  useEffect(() => {
    if (!supabase || !user || !profile) return

    Promise.all([
      supabase.from('products').select('id, description, craft_story').eq('user_id', user.id),
      supabase.from('generated_content').select('id').eq('user_id', user.id),
    ]).then(([productsRes, contentRes]) => {
      const products = productsRes.data ?? []
      const content = contentRes.data ?? []
      // Descriptions and craft stories are saved directly onto the product row
      // (app/content/page.tsx), not logged as generated_content rows — only
      // marketing posts from /promote go there. Count both sources so the
      // checklist reflects real writing effort either way.
      const withDescription = products.filter((p) => p.description).length
      const withCraftStory = products.filter((p) => p.craft_story).length

      setStats({
        productsCount: products.length,
        contentCount: content.length + withDescription + withCraftStory,
        cataloguePublished: profile.catalogue_published,
      })
    })
  }, [user, profile])

  // recent/contentToday stay null on a failed query (e.g. table missing) — falls
  // back to demo data rather than showing a misleading "0".
  const recentToShow = recent
  const contentUsed = contentToday ?? 8

  const checklist = stats ? [
    { done: stats.productsCount >= 1, labelKey: 'home.checklist.item.product' as TranslationKey, href: '/products' },
    { done: !!profile?.profile_photo_url, labelKey: 'home.checklist.item.photo' as TranslationKey, href: '/profile' },
    { done: !!profile?.about, labelKey: 'home.checklist.item.story' as TranslationKey, href: '/profile' },
    { done: stats.contentCount >= 1, labelKey: 'home.checklist.item.content' as TranslationKey, href: '/content' },
    { done: stats.cataloguePublished, labelKey: 'home.checklist.item.publish' as TranslationKey, href: '/profile' },
  ] : []
  const checklistDone = checklist.filter((c) => c.done).length
  const checklistTotal = checklist.length
  const allDone = checklistTotal > 0 && checklistDone === checklistTotal

  return (
    <div>

      {/* ── Greeting banner ─────────────────────────────── */}
      <div id="tour-greeting" className="ks-banner-ikat" style={{
        borderRadius: 16,
        padding: '22px 24px 22px',
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <FeatherFlourish style={{ position: 'absolute', right: -12, bottom: -18, width: 150, height: 130 }} />
        <ProductTour />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, position: 'relative' }}>
          <div style={{ position: 'relative', width: 65, height: 46, flexShrink: 0 }}>
            {/* A rangoli dot-ring — the small mark drawn at a threshold —
                framing the peacock mark, echoed by the frieze/motif classes
                already used elsewhere on this page. */}
            <svg viewBox="0 0 46 46" preserveAspectRatio="none" style={{ position: 'absolute', top: -5, left: -5, width: 75, height: 56 }} aria-hidden="true">
              <g fill="rgba(212,160,23,0.55)">
                <circle cx="23" cy="1.5" r="1.4" /><circle cx="34" cy="4.5" r="1.4" /><circle cx="42" cy="13" r="1.4" />
                <circle cx="44.5" cy="24" r="1.4" /><circle cx="40" cy="35" r="1.4" /><circle cx="30" cy="43" r="1.4" />
                <circle cx="18" cy="43" r="1.4" /><circle cx="8" cy="36" r="1.4" /><circle cx="2.5" cy="25" r="1.4" />
                <circle cx="4" cy="14" r="1.4" /><circle cx="12" cy="5" r="1.4" />
              </g>
            </svg>
            <div style={{
              width: 65, height: 46, borderRadius: 12, background: '#F9E9D6',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)', position: 'relative',
            }}>
              <PeacockMark size={46} />
            </div>
          </div>
          <div>
            <p style={{ color: 'var(--ks-turmeric)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>
              {t(greetingKey())}
            </p>
            <h1 style={{
              color: '#fff',
              fontSize: 22,
              fontFamily: 'var(--font-display)',
              lineHeight: 1.15,
            }}>
              {profile?.name ?? t('home.greetingFallback')}
            </h1>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <UsageMeter label={t('home.contentToday')} used={contentUsed} total={DAILY_CONTENT_LIMIT} />
        </div>
      </div>

      <div className="ks-frieze" style={{ marginBottom: 24 }} />

      {/* ── Getting started checklist ───────────────────── */}
      {stats && checklistTotal > 0 && (
        <div id="tour-challenges" className="ks-motif-frame" style={{ marginBottom: 20 }}>
          <div className="ks-motif-frame-body">
            <p style={{
              fontSize: 11, fontWeight: 700, color: 'var(--ks-clay)',
              textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: allDone ? 6 : 4,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="ks-motif-dot" aria-hidden="true" />
              {t('home.checklist.title')}
              <span className="ks-motif-dot" aria-hidden="true" />
            </p>

            {allDone ? (
              <p style={{ fontSize: 13.5, color: 'var(--ks-earth)', lineHeight: 1.6 }}>
                <span aria-hidden="true">🎉 </span>{t('home.checklist.done')}
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <ProgressRing done={checklistDone} total={checklistTotal} />
                  <p style={{ fontSize: 11.5, color: 'var(--ks-muted)', flex: 1 }}>
                    {t('home.checklist.progress').replace('{done}', String(checklistDone)).replace('{total}', String(checklistTotal))}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {checklist.map((item) => (
                    <a
                      key={item.labelKey}
                      href={item.href}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                        padding: '9px 10px', borderRadius: 9,
                        background: item.done ? 'transparent' : 'var(--ks-linen)',
                      }}
                    >
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: item.done ? 'var(--ks-jade)' : '#fff',
                        border: item.done ? 'none' : '1.5px solid var(--ks-border)',
                        color: '#fff',
                      }}>
                        {item.done && <IconCheck size={13} />}
                      </span>
                      <span style={{
                        fontSize: 13.5,
                        color: item.done ? 'var(--ks-muted)' : 'var(--ks-earth)',
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}>
                        {t(item.labelKey)}
                      </span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Invite & Earn banner ────────────────────────── */}
      {/* Always visible, not gated on artisansEmpowered > 0 — this is the
          primary discovery surface for the Saathi referral program, and
          most artisans start at zero empowerments. Gating it on a nonzero
          count would hide the entire feature from exactly the people who
          haven't used it yet. */}
      <a
        id="tour-saathi-banner"
        href="/saathi"
        style={{
          display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none',
          background: 'var(--ks-clay)', borderRadius: 14, padding: '16px 18px',
          marginBottom: 20, boxShadow: '0 4px 14px rgba(196,85,45,0.25)',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <IconSaathi size={22} style={{ color: '#fff' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
            {t('saathi.ctaTitle')}
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
            {t('saathi.ctaDesc')}
          </div>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--ks-clay)',
          background: '#fff', borderRadius: 999, padding: '8px 14px', whiteSpace: 'nowrap',
        }}>
          {t('saathi.inviteArtisan')}
        </span>
      </a>

      {/* ── Impact + wallet + learning nudge ────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <Link href="/wallet" style={{ ...dashChipStyle, flex: '1 1 130px' }}>
          <IconWallet size={18} style={{ color: 'var(--ks-clay)' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ks-earth)' }}>
              {walletBalance === null ? '…' : walletBalance}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ks-muted)' }}>{t('home.kalaPoints')}</div>
          </div>
        </Link>
        <Link href="/saathi" style={{ ...dashChipStyle, flex: '1 1 130px' }}>
          <IconSaathi size={18} style={{ color: 'var(--ks-clay)' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ks-earth)' }}>{artisansEmpowered ?? 0}</div>
            <div style={{ fontSize: 10, color: 'var(--ks-muted)' }}>{t('home.artisansEmpowered')}</div>
          </div>
        </Link>
        <Link href="/upskill" style={{ ...dashChipStyle, flex: '1 1 130px' }}>
          <IconUpskill size={18} style={{ color: 'var(--ks-clay)' }} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ks-earth)' }}>{t('home.continueLearning')}</div>
            <div style={{ fontSize: 10, color: 'var(--ks-muted)' }}>{t('nav.upskill')} →</div>
          </div>
        </Link>
      </div>

      <VoiceAgentBanner />

      {/* ── Quick actions ────────────────────────────────── */}
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        marginBottom: 16,
        color: 'var(--ks-earth)',
      }}>
        {t('home.whatToDo')}
      </h2>

      <div id="tour-actions" className="ks-qa-scroll" style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        margin: '0 -20px 28px',
        padding: '2px 20px 6px',
      }}>
        {PRIMARY_ACTIONS.map((action) => (
          <a
            key={action.titleKey}
            href={action.href}
            onClick={action.isModal ? (e) => { e.preventDefault(); openAskAI() } : undefined}
            className="ks-qa-item"
            style={{
              flexShrink: 0,
              width: 92,
              background: 'var(--ks-ivory)',
              borderRadius: 14,
              padding: '14px 10px',
              border: '1px solid var(--ks-border)',
              boxShadow: '0 2px 8px rgba(19,42,69,0.05)',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 8,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${action.accent}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <action.Icon size={22} style={{ color: action.accent }} />
            </div>
            <div style={{
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 11.5,
              color: 'var(--ks-earth)', lineHeight: 1.3,
            }}>
              {t(action.titleKey)}
            </div>
          </a>
        ))}
      </div>

      <div className="ks-zari-band" style={{ marginBottom: 20, borderRadius: 3 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 32 }}>
        {GROW_ACTIONS.map((action) => (
          <a
            key={action.titleKey}
            href={action.href}
            className="ks-qa-row"
            style={{
              display: 'flex', alignItems: 'center', gap: 13,
              background: 'var(--ks-ivory)', borderRadius: 14, padding: '13px 15px',
              border: '1px solid var(--ks-border)', boxShadow: '0 1px 4px rgba(19,42,69,0.04)',
              textDecoration: 'none',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: `${action.accent}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <action.Icon size={20} style={{ color: action.accent }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13.5, color: 'var(--ks-earth)', marginBottom: 1 }}>
                {t(action.titleKey)}
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--ks-muted)', lineHeight: 1.4 }}>
                {t(action.descKey)}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ks-border)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </a>
        ))}
      </div>

      <style jsx>{`
        .ks-qa-scroll::-webkit-scrollbar { display: none; }
        .ks-qa-item, .ks-qa-row { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .ks-qa-item:active, .ks-qa-row:active { transform: scale(0.97); }
        @media (hover: hover) {
          .ks-qa-item:hover, .ks-qa-row:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(19,42,69,0.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ks-qa-item, .ks-qa-row { transition: none; }
        }
      `}</style>

      {/* ── Recent creations ─────────────────────────────── */}
      <h2 id="tour-recent" style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        marginBottom: 16,
        color: 'var(--ks-earth)',
      }}>
        {t('home.recentCreations')}
      </h2>

      {recentToShow === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DEMO_RECENT.map((item) => {
            const time = item.timeN ? t(item.timeKey).replace('{n}', String(item.timeN)) : t(item.timeKey)
            return (
              <RecentRowCard key={item.productKey} emoji={item.emoji} title={t(item.productKey)} subtitle={`${t(item.labelKey)} · ${time}`} preset={item.presetKey ? t(item.presetKey) : null} />
            )
          })}
        </div>
      ) : recentToShow.length === 0 ? (
        <div className="ks-lattice" style={{
          backgroundColor: 'var(--ks-ivory)', border: '1px solid var(--ks-border)',
          borderRadius: 12, padding: '20px 16px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>
            {t('home.recentEmpty')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recentToShow.map((item) => {
            const meta = CONTENT_TYPE_META[item.content_type]
            const emoji = meta?.emoji ?? '✨'
            const label = meta ? t(meta.labelKey) : item.content_type
            return (
              <RecentRowCard
                key={item.id}
                emoji={emoji}
                title={item.product_name}
                subtitle={`${label} · ${timeAgo(item.created_at, t)}`}
                preset={null}
                onClick={() => setSelectedRecent(item)}
              />
            )
          })}
        </div>
      )}

      {selectedRecent && (
        <RecentDetailModal
          item={selectedRecent}
          typeLabel={CONTENT_TYPE_META[selectedRecent.content_type] ? t(CONTENT_TYPE_META[selectedRecent.content_type].labelKey) : selectedRecent.content_type}
          onClose={() => setSelectedRecent(null)}
        />
      )}

    </div>
  )
}

export default function HomePage() {
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  // Unlike every other authenticated route, "/" doubles as the front door —
  // a logged-out visitor should see a pitch for the product, not get bounced
  // straight to a bare login form with zero context.
  if (!supabaseConfigured) return <HomePageContent />
  if (loading) return <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>{t('common.loading')}</p>
  if (!user) return <LandingPage />
  return <HomePageContent />
}

/* ── Recent creation row ─────────────────────────────────── */
function RecentRowCard({
  emoji,
  title,
  subtitle,
  preset,
  onClick,
}: {
  emoji: string
  title: string
  subtitle: string
  preset: string | null
  onClick?: () => void
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      className={onClick ? 'ks-recent-card' : undefined}
      style={{
        background: 'var(--ks-ivory)',
        borderRadius: 12,
        padding: '14px 16px',
        border: '1px solid var(--ks-border)',
        boxShadow: '0 2px 8px rgba(19,42,69,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: onClick ? 'pointer' : undefined,
        minHeight: 44,
      }}
    >
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 11,
        background: 'rgba(212,160,23,0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
      }}>
        {emoji}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ks-earth)' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ks-muted)', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      {preset && (
        <span style={{
          background: 'rgba(161,61,46,0.12)',
          color: 'var(--ks-clay)',
          borderRadius: 20,
          padding: '2px 10px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}>
          {preset}
        </span>
      )}
      <style jsx>{`
        .ks-recent-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .ks-recent-card:active {
          transform: scale(0.98);
        }
        @media (hover: hover) {
          .ks-recent-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(19,42,69,0.12);
          }
        }
        .ks-recent-card:focus-visible {
          outline: 2px solid var(--ks-turmeric);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .ks-recent-card { transition: none; }
        }
      `}</style>
    </div>
  )
}

function RecentDetailModal({
  item,
  typeLabel,
  onClose,
}: {
  item: RecentRow
  typeLabel: string
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(item.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(19,42,69,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', padding: 22, margin: 'auto 0' }}
      >
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ks-indigo)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 14 }}>
          ← {t('common.close')}
        </button>

        <div style={{ fontSize: 11, color: 'var(--ks-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
          {typeLabel} · {new Date(item.created_at).toLocaleString()}
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ks-earth)', marginBottom: 16 }}>
          {item.product_name}
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ks-earth)', whiteSpace: 'pre-wrap', marginBottom: 18 }}>
          {item.content}
        </p>
        <button type="button" onClick={handleCopy} style={{
          background: copied ? 'var(--ks-jade)' : 'var(--ks-indigo)', color: '#fff', border: 'none',
          borderRadius: 9, padding: '10px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer',
        }}>
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
    </div>
  )
}

/* ── Getting-started progress ring ──────────────────────── */
const dashChipStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)',
  boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 12, padding: '12px 13px', textDecoration: 'none',
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 17
  const circumference = 2 * Math.PI * r
  const pct = total > 0 ? done / total : 0
  return (
    <div style={{ position: 'relative', width: 42, height: 42, flexShrink: 0 }}>
      <svg width="42" height="42" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--ks-border)" strokeWidth="4" />
        <circle
          cx="21" cy="21" r={r} fill="none" stroke="var(--ks-clay)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)}
          transform="rotate(-90 21 21)"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: 'var(--ks-earth)',
      }}>
        {done}/{total}
      </div>
    </div>
  )
}

/* ── Usage meter component ──────────────────────────────── */
function UsageMeter({
  label,
  used,
  total,
}: {
  label: string
  used: number
  total: number
}) {
  const pct = Math.round((used / total) * 100)

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 5,
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
      }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{used}/{total}</span>
      </div>
      <div style={{
        width: '100%',
        maxWidth: 260,
        height: 4,
        background: 'rgba(255,255,255,0.25)',
        borderRadius: 2,
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: '#fff',
          borderRadius: 2,
        }} />
      </div>
    </div>
  )
}
