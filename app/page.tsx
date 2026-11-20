'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import LandingPage from '@/components/LandingPage'
import { useLanguage } from '@/lib/LanguageProvider'
import { useAskAI } from '@/lib/AskAIProvider'
import type { TranslationKey } from '@/lib/translations'
import ProductTour from '@/components/ProductTour'
import VoiceAgentBanner from '@/components/VoiceAgentBanner'
import { useLocalHour } from '@/lib/useLocalHour'
import PeacockMark from '@/components/PeacockMark'
import { GondCloud, GondScene, skyTimeFor } from '@/components/GondArt'
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

type RowIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties }>

const DEMO_RECENT: { Icon: RowIcon; labelKey: TranslationKey; productKey: TranslationKey; presetKey: TranslationKey | null; timeKey: TranslationKey; timeN?: number }[] = [
  { Icon: IconStudio, labelKey: 'home.demo.photoshoot', productKey: 'home.demo.product.jamdani', presetKey: 'studio.preset.studio', timeKey: 'time.hoursAgo', timeN: 2 },
  { Icon: IconPromote, labelKey: 'home.demo.instagramPost', productKey: 'home.demo.product.kalamkari', presetKey: 'studio.preset.festival', timeKey: 'time.yesterday' },
  { Icon: IconContent, labelKey: 'home.demo.description', productKey: 'home.demo.product.filigree', presetKey: null, timeKey: 'time.daysAgo', timeN: 2 },
]

const CONTENT_TYPE_META: Record<string, { Icon: RowIcon; labelKey: TranslationKey }> = {
  description: { Icon: IconContent, labelKey: 'home.contentType.description' },
  caption: { Icon: IconPromote, labelKey: 'home.contentType.caption' },
  whatsapp: { Icon: IconCoach, labelKey: 'home.contentType.whatsapp' },
  catalogue: { Icon: IconCatalogue, labelKey: 'home.contentType.catalogue' },
}

const DAILY_CONTENT_LIMIT = 20

// Was hardcoded to "Good morning" no matter when someone actually logged in.
// Uses the device's local clock (not a server timestamp), so it's correct
// for whatever timezone the artisan is actually in.
function greetingKey(hour: number | null): TranslationKey {
  // Before 5 am the painted sky is still night, so the greeting stays
  // "evening" instead of saying "Good morning" under the moon.
  if (hour !== null && hour < 5) return 'home.greetingEvening'
  if (hour === null || hour < 12) return 'home.greeting'
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

function HomePageContent({ demo = false }: { demo?: boolean }) {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const hour = useLocalHour()
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

  // Demo data is only for a build with no Supabase configured (a local
  // preview). A real artisan used to see a made-up "8/20" quota and three
  // invented creations while their own data loaded, or forever if a query
  // failed; now they see a loading placeholder and then their real data.
  const recentToShow = demo ? null : recent
  const contentUsed = demo ? 8 : contentToday

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
    <div className="ks-rise">

      {/* ── Greeting: a painted sky that follows the local time ─ */}
      <GondScene id="tour-greeting" compact sky={hour === null ? 'night' : skyTimeFor(hour)} className="ks-scene-top">
        <ProductTour />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, paddingRight: 96 }}>
          <div className="ks-medallion" style={{
            ...accentVar('#E0A526'), width: 54, height: 54, background: 'var(--ks-paper)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          }}>
            <PeacockMark size={30} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="ks-eyebrow" style={{ color: 'var(--scene-accent)', fontSize: 10.5, marginBottom: 4 }}>
              {t(greetingKey(hour))}
            </p>
            <h1 style={{ color: 'var(--scene-ink)', fontSize: 'clamp(21px, 4.4vw, 27px)', fontFamily: 'var(--font-display)', lineHeight: 1.15 }}>
              {profile?.name ?? t('home.greetingFallback')}
            </h1>
          </div>
        </div>
        <div style={{ maxWidth: 300 }}>
          <UsageMeter label={t('home.contentToday')} used={contentUsed} total={DAILY_CONTENT_LIMIT} />
        </div>
      </GondScene>

      <VoiceAgentBanner />

      {/* ── Points, people helped, learning: medallion tiles ─ */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10,
        marginTop: -30, marginBottom: 26, position: 'relative', zIndex: 2,
      }}>
        <Link href="/wallet" className="ks-tile ks-press" style={{ ...statTileStyle, ...accentVar('#B7860F') }}>
          <span className="ks-medallion" style={{ ...accentVar('#B7860F'), width: 36, height: 36 }}><IconWallet size={17} /></span>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ks-earth)', fontFamily: 'var(--font-display)' }}>
            {walletBalance === null ? <span className="ks-skeleton" aria-label={t('common.loading')} style={{ display: 'inline-block', width: 36, height: 14, verticalAlign: 'middle' }} /> : walletBalance}
          </span>
          <span style={statLabelStyle}>{t('home.kalaPoints')}</span>
        </Link>
        <Link href="/saathi" className="ks-tile ks-press" style={{ ...statTileStyle, ...accentVar('#A8432A') }}>
          <span className="ks-medallion" style={{ ...accentVar('#A8432A'), width: 36, height: 36 }}><IconSaathi size={17} /></span>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ks-earth)', fontFamily: 'var(--font-display)' }}>{artisansEmpowered ?? 0}</span>
          <span style={statLabelStyle}>{t('home.artisansEmpowered')}</span>
        </Link>
        <Link href="/upskill" className="ks-tile ks-press" style={{ ...statTileStyle, ...accentVar('#1F5A57') }}>
          <span className="ks-medallion" style={{ ...accentVar('#1F5A57'), width: 36, height: 36 }}><IconUpskill size={17} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ks-earth)', lineHeight: 1.25 }}>{t('home.continueLearning')}</span>
          <span style={statLabelStyle}>{t('nav.upskill')} →</span>
        </Link>
      </div>

      {/* ── Getting started checklist ───────────────────── */}
      {stats && checklistTotal > 0 && (
        <div id="tour-challenges" className="ks-panel" style={{ marginBottom: 24, padding: '20px 18px' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p className="ks-eyebrow" style={{
              fontSize: 11, fontWeight: 700, color: 'var(--ks-clay)', marginBottom: allDone ? 6 : 4,
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
                    <Link
                      key={item.labelKey}
                      href={item.href}
                      className="ks-press"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                        padding: '9px 10px', borderRadius: 9,
                        background: item.done ? 'transparent' : 'rgba(234, 220, 192, 0.5)', position: 'relative',
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
                    </Link>
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
      <Link
        id="tour-saathi-banner"
        href="/saathi"
        className="ks-press ks-band-rust"
        style={{
          display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', position: 'relative', overflow: 'hidden',
          borderRadius: 18, padding: '18px 18px', marginBottom: 30,
          outline: '1.5px dotted rgba(244,231,195,0.5)', outlineOffset: -6,
          boxShadow: '0 6px 18px rgba(168,67,42,0.28)',
        }}
      >
        <GondCloud style={{ position: 'absolute', right: -18, bottom: -14, width: 96, opacity: 0.25 }} />
        <span className="ks-medallion" style={{ ...accentVar('#F4E7C3'), background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
          <IconSaathi size={22} />
        </span>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2, fontFamily: 'var(--font-display)' }}>
            {t('saathi.ctaTitle')}
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
            {t('saathi.ctaDesc')}
          </div>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--ks-earth)', position: 'relative',
          background: 'var(--ks-turmeric)', borderRadius: 999, padding: '8px 14px', whiteSpace: 'nowrap',
        }}>
          {t('saathi.inviteArtisan')}
        </span>
      </Link>

      {/* ── Quick actions ────────────────────────────────── */}
      <h2 className="ks-section-title">
        {t('home.whatToDo')}
      </h2>

      <div id="tour-actions" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 30,
      }}>
        {PRIMARY_ACTIONS.map((action) => {
          const body = (
            <>
              <span className="ks-medallion" style={accentVar(action.accent)}>
                <action.Icon size={22} />
              </span>
              <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ks-earth)', lineHeight: 1.3, position: 'relative' }}>
                {t(action.titleKey)}
              </span>
            </>
          )
          // The AI coach opens a modal, so it is a real button, not a link
          // that cancels its own navigation.
          return action.isModal ? (
            <button key={action.titleKey} type="button" onClick={openAskAI} className="ks-tile ks-press" style={{ ...qaTileStyle, ...accentVar(action.accent) }}>{body}</button>
          ) : (
            <Link key={action.titleKey} href={action.href} className="ks-tile ks-press" style={{ ...qaTileStyle, ...accentVar(action.accent) }}>{body}</Link>
          )
        })}
      </div>

      <div className="ks-frieze" style={{ marginBottom: 22 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 10, marginBottom: 34 }}>
        {GROW_ACTIONS.map((action) => (
          <Link
            key={action.titleKey}
            href={action.href}
            className="ks-panel ks-press"
            style={{ ...accentVar(action.accent), display: 'flex', alignItems: 'center', gap: 15, padding: '15px 16px', textDecoration: 'none' }}
          >
            <span className="ks-medallion" style={{ ...accentVar(action.accent), width: 40, height: 40 }}>
              <action.Icon size={19} />
            </span>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13.5, color: 'var(--ks-earth)', marginBottom: 1 }}>
                {t(action.titleKey)}
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--ks-muted)', lineHeight: 1.4 }}>
                {t(action.descKey)}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ks-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        ))}
      </div>

      {/* ── Recent creations ─────────────────────────────── */}
      <h2 id="tour-recent" className="ks-section-title">
        {t('home.recentCreations')}
      </h2>

      {recentToShow === null && !demo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2].map((i) => <div key={i} className="ks-skeleton" style={{ height: 70 }} />)}
        </div>
      ) : recentToShow === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DEMO_RECENT.map((item) => {
            const time = item.timeN ? t(item.timeKey).replace('{n}', String(item.timeN)) : t(item.timeKey)
            return (
              <RecentRowCard key={item.productKey} Icon={item.Icon} title={t(item.productKey)} subtitle={`${t(item.labelKey)} · ${time}`} preset={item.presetKey ? t(item.presetKey) : null} />
            )
          })}
        </div>
      ) : recentToShow.length === 0 ? (
        <div className="ks-lattice" style={{
          backgroundColor: 'var(--ks-ivory)', border: '1px solid var(--ks-border)',
          borderRadius: 12, padding: '20px 16px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'var(--ks-muted)', marginBottom: 14 }}>
            {t('home.recentEmpty')}
          </p>
          <Link href="/promote" className="ks-press" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44,
            background: 'var(--ks-earth)', color: '#fff', borderRadius: 10,
            padding: '10px 18px', fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
          }}>
            <IconPromote size={16} />
            {t('home.recentEmptyCta')}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recentToShow.map((item) => {
            const meta = CONTENT_TYPE_META[item.content_type]
            const Icon = meta?.Icon ?? IconContent
            const label = meta ? t(meta.labelKey) : item.content_type
            return (
              <RecentRowCard
                key={item.id}
                Icon={Icon}
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
  if (!supabaseConfigured) return <HomePageContent demo />
  if (loading) return <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>{t('common.loading')}</p>
  if (!user) return <LandingPage />
  return <HomePageContent />
}

/* ── Recent creation row ─────────────────────────────────── */
function RecentRowCard({
  Icon,
  title,
  subtitle,
  preset,
  onClick,
}: {
  Icon: RowIcon
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
      className={onClick ? 'ks-press' : undefined}
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
        flexShrink: 0,
        color: 'var(--ks-clay)',
      }}>
        <Icon size={20} />
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

const accentVar = (c: string) => ({ ['--accent' as string]: c }) as React.CSSProperties

const qaTileStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12,
  padding: '20px 10px 16px', minHeight: 116, textDecoration: 'none', font: 'inherit', cursor: 'pointer',
}

const statTileStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
  padding: '13px 12px 12px', textDecoration: 'none', boxShadow: '0 8px 22px rgba(19,42,69,0.12)', minWidth: 0,
}

const statLabelStyle: React.CSSProperties = { fontSize: 10.5, color: 'var(--ks-muted)', lineHeight: 1.3 }

/* ── Getting-started progress ring ──────────────────────── */
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
  used: number | null
  total: number
}) {
  const pct = used === null ? 0 : Math.min(100, Math.round((used / total) * 100))

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 5,
        fontSize: 12,
        color: 'var(--scene-ink-soft, rgba(255,255,255,0.8))',
      }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{used === null ? '–' : used}/{total}</span>
      </div>
      <div style={{
        width: '100%',
        maxWidth: 260,
        height: 4,
        background: 'var(--scene-track, rgba(255,255,255,0.25))',
        borderRadius: 2,
      }}>
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={used ?? undefined}
          style={{
            width: '100%',
            height: '100%',
            background: 'var(--scene-ink, #fff)',
            borderRadius: 2,
            transform: `scaleX(${pct / 100})`,
            transformOrigin: 'left',
            transition: 'transform 600ms var(--ease-out)',
          }}
        />
      </div>
    </div>
  )
}
