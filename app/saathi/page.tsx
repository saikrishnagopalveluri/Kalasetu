'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'
import { BRAND } from '@/lib/brand'
import { IconSaathi } from '@/components/CraftIcons'

type DashboardData = {
  referralCode: string
  stats: { empoweredCount: number; activeCount: number; totalProducts: number; cataloguesCreated: number; rewardsEarnedRupees: number }
  community: { name: string; status: string; productsCount: number; cataloguePublished: boolean }[]
}

const STATUS_LABEL: Record<string, TranslationKey> = {
  INVITED: 'saathi.status.invited',
  REGISTERED: 'saathi.status.registered',
  PROFILE_COMPLETED: 'saathi.status.profileCompleted',
  FIRST_PRODUCT_COMPLETED: 'saathi.status.firstProduct',
  ONBOARDING_COMPLETED: 'saathi.status.onboardingComplete',
  REWARD_UNLOCKED: 'saathi.status.empowered',
}

function SaathiInner() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [data, setData] = useState<DashboardData | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!supabase || !user) return
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      const accessToken = sessionData.session?.access_token
      if (!accessToken) return
      const res = await fetch('/api/saathi-dashboard', { headers: { Authorization: `Bearer ${accessToken}` } })
      if (res.ok) setData(await res.json())
    })
  }, [user])

  const inviteLink = data ? `${BRAND.fallbackUrl}/signup?ref=${data.referralCode}` : ''

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: t('saathi.shareTitle'), text: t('saathi.shareText'), url: inviteLink }).catch(() => {})
    } else {
      navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('saathi.title')}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', marginBottom: 14, lineHeight: 1.6, maxWidth: 520 }}>
        {t('saathi.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 22 }} />

      <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
        {t('saathi.myImpact')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 26 }}>
        <StatCard n={data?.stats.empoweredCount ?? '…'} labelKey="saathi.stat.empowered" />
        <StatCard n={data ? `₹${data.stats.rewardsEarnedRupees}` : '…'} labelKey="saathi.stat.rewardsEarned" />
        <StatCard n={data?.stats.activeCount ?? '…'} labelKey="saathi.stat.activeArtisans" />
        <StatCard n={data?.stats.totalProducts ?? '…'} labelKey="saathi.stat.productsDigitised" />
        <StatCard n={data?.stats.cataloguesCreated ?? '…'} labelKey="saathi.stat.cataloguesCreated" />
      </div>

      <div style={{
        background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)',
        borderRadius: 14, padding: 20, marginBottom: 26,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <IconSaathi size={20} style={{ color: 'var(--ks-clay)' }} />
          <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ks-earth)' }}>{t('saathi.ctaTitle')}</p>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ks-muted)', lineHeight: 1.6, marginBottom: 16 }}>{t('saathi.ctaDesc')}</p>
        <button onClick={handleShare} disabled={!data} style={{
          background: 'var(--ks-indigo)', color: '#fff', border: 'none', borderRadius: 9, padding: '13px 20px',
          fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: data ? 'pointer' : 'default', width: '100%', minHeight: 46,
        }}>
          {copied ? t('common.copied') : t('saathi.inviteArtisan')}
        </button>
      </div>

      <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
        {t('saathi.myCommunity')}
      </p>

      {data === null ? (
        <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>{t('common.loading')}</p>
      ) : data.community.length === 0 ? (
        <div className="ks-lattice" style={{ backgroundColor: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 12, padding: '24px 18px', textAlign: 'center' }}>
          <p style={{ fontSize: 13.5, color: 'var(--ks-muted)' }}>{t('saathi.communityEmpty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.community.map((row, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 10, padding: '12px 14px',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ks-earth)' }}>{row.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginTop: 2 }}>
                  {row.productsCount} {t('saathi.productsLabel')}{row.cataloguePublished ? ` · ${t('saathi.catalogueLive')}` : ''}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, flexShrink: 0,
                background: row.status === 'REWARD_UNLOCKED' ? 'rgba(15,91,78,0.12)' : 'rgba(212,160,23,0.14)',
                color: row.status === 'REWARD_UNLOCKED' ? 'var(--ks-jade)' : 'var(--ks-turmeric)',
              }}>
                {t(STATUS_LABEL[row.status] ?? 'saathi.status.registered')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ n, labelKey }: { n: number | string; labelKey: TranslationKey }) {
  const { t } = useLanguage()
  return (
    <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--ks-earth)', marginBottom: 3 }}>{n}</div>
      <div style={{ fontSize: 10.5, color: 'var(--ks-muted)', lineHeight: 1.3 }}>{t(labelKey)}</div>
    </div>
  )
}

export default function SaathiPage() {
  return (
    <RequireAuth>
      <SaathiInner />
    </RequireAuth>
  )
}
