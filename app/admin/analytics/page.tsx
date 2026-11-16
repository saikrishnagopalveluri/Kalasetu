'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import RequireAdmin from '@/components/RequireAdmin'

type Stats = {
  totalArtisans: number
  tierCounts: Record<string, number>
  totalProducts: number
  totalContent: number
  contentToday: number
  signupsThisWeek: number
}

const TIER_PRICE: Record<string, number> = { free: 0, starter: 99, pro: 299, premium: 599 }
const TIER_COLOR: Record<string, string> = {
  free: 'var(--ks-muted)',
  starter: 'var(--ks-saffron)',
  pro: 'var(--ks-indigo)',
  premium: 'var(--ks-jade)',
}

function AnalyticsInner() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    async function load() {
      const [profiles, products, content] = await Promise.all([
        supabase!.from('artisan_profiles').select('subscription_tier, created_at'),
        supabase!.from('products').select('id', { count: 'exact', head: true }),
        supabase!.from('generated_content').select('created_at'),
      ])

      const tierCounts: Record<string, number> = {}
      let signupsThisWeek = 0
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      for (const p of profiles.data ?? []) {
        tierCounts[p.subscription_tier] = (tierCounts[p.subscription_tier] ?? 0) + 1
        if (new Date(p.created_at).getTime() > weekAgo) signupsThisWeek++
      }

      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      let contentToday = 0
      for (const c of content.data ?? []) {
        if (new Date(c.created_at).getTime() > startOfDay.getTime()) contentToday++
      }

      setStats({
        totalArtisans: profiles.data?.length ?? 0,
        tierCounts,
        totalProducts: products.count ?? 0,
        totalContent: content.data?.length ?? 0,
        contentToday,
        signupsThisWeek,
      })
    }
    load()
  }, [])

  const monthlyRevenue = stats
    ? Object.entries(stats.tierCounts).reduce((sum, [tier, count]) => sum + (TIER_PRICE[tier] ?? 0) * count, 0)
    : 0

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ks-earth)', marginBottom: 4 }}>
        Analytics &amp; Revenue
      </h1>
      <Link href="/admin" style={{ fontSize: 12.5, color: 'var(--ks-indigo)', textDecoration: 'none' }}>← Admin home</Link>

      {!stats ? (
        <p style={{ fontSize: 13, color: 'var(--ks-muted)', marginTop: 20 }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, margin: '20px 0' }}>
            <StatTile label="Total artisans" value={stats.totalArtisans} />
            <StatTile label="Signups this week" value={stats.signupsThisWeek} accent="var(--ks-jade)" />
            <StatTile label="Products saved" value={stats.totalProducts} />
            <StatTile label="Content generated" value={stats.totalContent} />
            <StatTile label="Generated today" value={stats.contentToday} accent="var(--ks-jade)" />
          </div>

          <p style={sectionLabel}>Subscription tiers</p>
          <TierDistributionBar tierCounts={stats.tierCounts} total={stats.totalArtisans} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '10px 0 24px' }}>
            {Object.keys(TIER_PRICE).map((tier) => (
              <div key={tier} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 10, padding: '10px 16px',
                borderLeft: `3px solid ${TIER_COLOR[tier]}`,
              }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ks-earth)', textTransform: 'capitalize' }}>{tier}</span>
                <span style={{ fontSize: 13, color: 'var(--ks-muted)' }}>
                  {stats.tierCounts[tier] ?? 0} artisans · ₹{TIER_PRICE[tier]}/mo
                </span>
              </div>
            ))}
          </div>

          <p style={sectionLabel}>Monthly recurring revenue (estimated)</p>
          <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 10, padding: 16, marginBottom: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ks-jade)', fontFamily: 'var(--font-display)' }}>₹{monthlyRevenue.toLocaleString('en-IN')}</div>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--ks-muted)', lineHeight: 1.6 }}>
            Based on current tier assignments. No payment processing is connected yet, so this reflects tier prices only, not actual billed or collected revenue.
          </p>
        </>
      )}
    </div>
  )
}

function TierDistributionBar({ tierCounts, total }: { tierCounts: Record<string, number>; total: number }) {
  if (total === 0) {
    return <p style={{ fontSize: 12, color: 'var(--ks-muted)', marginBottom: 4 }}>No artisans yet.</p>
  }
  return (
    <div>
      <div style={{ display: 'flex', width: '100%', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--ks-linen)' }}>
        {Object.keys(TIER_PRICE).map((tier) => {
          const count = tierCounts[tier] ?? 0
          if (count === 0) return null
          const pct = (count / total) * 100
          return (
            <div
              key={tier}
              title={`${tier}: ${count} (${pct.toFixed(1)}%)`}
              style={{ width: `${pct}%`, background: TIER_COLOR[tier], minWidth: count > 0 ? 2 : 0 }}
            />
          )
        })}
      </div>
    </div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{
      background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 10, padding: '12px 14px',
      boxShadow: '0 1px 2px rgba(19,42,69,0.05)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--ks-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ?? 'var(--ks-earth)', fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--ks-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10,
}

export default function AnalyticsPage() {
  return (
    <RequireAdmin>
      <AnalyticsInner />
    </RequireAdmin>
  )
}
