'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import RequireAdmin from '@/components/RequireAdmin'
import { BRAND } from '@/lib/brand'

type Referral = {
  id: string
  saathi_id: string
  referred_user_id: string | null
  status: string
  created_at: string
}
type Reward = { id: string; referral_id: string; saathi_id: string; amount_paise: number; status: string; paid_at: string | null }
type Profile = { id: string; name: string }

function AdminSaathiInner() {
  const [referrals, setReferrals] = useState<Referral[] | null>(null)
  const [rewards, setRewards] = useState<Reward[] | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [walletIssued, setWalletIssued] = useState<{ earned: number; redeemed: number } | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)

  async function load() {
    if (!supabase) return
    const { data: referralRows } = await supabase.from('saathi_referrals').select('id, saathi_id, referred_user_id, status, created_at').order('created_at', { ascending: false })
    const { data: rewardRows } = await supabase.from('saathi_rewards').select('id, referral_id, saathi_id, amount_paise, status, paid_at')
    const { data: walletRows } = await supabase.from('wallet_transactions').select('amount')

    setReferrals(referralRows ?? [])
    setRewards(rewardRows ?? [])
    if (walletRows) {
      setWalletIssued({
        earned: walletRows.filter((r) => r.amount > 0).reduce((sum, r) => sum + r.amount, 0),
        redeemed: Math.abs(walletRows.filter((r) => r.amount < 0).reduce((sum, r) => sum + r.amount, 0)),
      })
    }

    const ids = [...new Set([
      ...(referralRows ?? []).flatMap((r) => [r.saathi_id, r.referred_user_id]),
    ].filter((id): id is string => !!id))]
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('artisan_profiles').select('id, name').in('id', ids)
      setNames(new Map((profiles ?? []).map((p: Profile) => [p.id, p.name])))
    }
  }

  // load() is async and only sets state after its database query resolves,
  // so nothing is set synchronously here; the linter cannot see past the await.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  async function markPaid(rewardId: string) {
    if (!supabase) return
    setMarkingId(rewardId)
    const { data: sessionData } = await supabase.auth.getSession()
    const adminId = sessionData.session?.user.id
    await supabase.from('saathi_rewards').update({ status: 'PAID', paid_at: new Date().toISOString(), paid_by: adminId }).eq('id', rewardId)
    await load()
    setMarkingId(null)
  }

  const saathiCounts = new Map<string, number>()
  for (const r of referrals ?? []) saathiCounts.set(r.saathi_id, (saathiCounts.get(r.saathi_id) ?? 0) + 1)
  const burstySaathis = [...saathiCounts.entries()].filter(([, count]) => count >= 10)

  const totals = {
    saathis: saathiCounts.size,
    onboarded: (referrals ?? []).length,
    empowered: (referrals ?? []).filter((r) => r.status === 'REWARD_UNLOCKED').length,
    rewardsPaidRupees: Math.round((rewards ?? []).filter((r) => r.status === 'PAID').reduce((s, r) => s + r.amount_paise, 0) / 100),
    rewardsUnpaidRupees: Math.round((rewards ?? []).filter((r) => r.status === 'UNPAID').reduce((s, r) => s + r.amount_paise, 0) / 100),
    pending: (referrals ?? []).filter((r) => !['REWARD_UNLOCKED'].includes(r.status)).length,
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ks-earth)', marginBottom: 4 }}>{BRAND.name} Saathi</h1>
      <Link href="/admin" style={{ fontSize: 12.5, color: 'var(--ks-indigo)', textDecoration: 'none' }}>← Admin home</Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, margin: '20px 0 26px' }}>
        <Stat label="Total Saathis" n={totals.saathis} />
        <Stat label="Artisans Onboarded" n={totals.onboarded} />
        <Stat label="Successful Empowerments" n={totals.empowered} />
        <Stat label="Rewards Paid" n={`₹${totals.rewardsPaidRupees}`} />
        <Stat label="Rewards Owed (Unpaid)" n={`₹${totals.rewardsUnpaidRupees}`} accent="var(--ks-clay)" />
        <Stat label="Pending Onboarding" n={totals.pending} />
        <Stat label="KalaPoints Issued" n={walletIssued?.earned ?? '—'} />
        <Stat label="KalaPoints Redeemed" n={walletIssued?.redeemed ?? '—'} />
      </div>

      {burstySaathis.length > 0 && (
        <div style={{ background: 'rgba(196,85,45,0.08)', border: '1px solid rgba(196,85,45,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ks-clay)', marginBottom: 6 }}>⚠ Flagged for review — unusually high referral count</p>
          {burstySaathis.map(([id, count]) => (
            <p key={id} style={{ fontSize: 12.5, color: 'var(--ks-earth)' }}>{names.get(id) ?? id}: {count} referrals</p>
          ))}
        </div>
      )}

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ks-earth)', marginBottom: 12 }}>Referrals</h2>
      {referrals === null ? (
        <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ks-muted)', borderBottom: '1px solid var(--ks-border)' }}>
                <th style={thStyle}>Saathi</th>
                <th style={thStyle}>Referred Artisan</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Reward</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => {
                const reward = (rewards ?? []).find((rw) => rw.referral_id === r.id)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--ks-border)' }}>
                    <td style={tdStyle}>{names.get(r.saathi_id) ?? r.saathi_id.slice(0, 8)}</td>
                    <td style={tdStyle}>{r.referred_user_id ? (names.get(r.referred_user_id) ?? r.referred_user_id.slice(0, 8)) : '—'}</td>
                    <td style={tdStyle}>{r.status}</td>
                    <td style={tdStyle}>{reward ? `${reward.status} · ₹${reward.amount_paise / 100}` : '—'}</td>
                    <td style={tdStyle}>
                      {reward && reward.status === 'UNPAID' && (
                        <button onClick={() => markPaid(reward.id)} disabled={markingId === reward.id} style={markPaidBtn}>
                          {markingId === reward.id ? 'Saving…' : 'Mark as Paid'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, n, accent }: { label: string; n: number | string; accent?: string }) {
  return (
    <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 12, padding: '13px 12px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: accent ?? 'var(--ks-earth)' }}>{n}</div>
      <div style={{ fontSize: 10.5, color: 'var(--ks-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '8px 10px', fontWeight: 600 }
const tdStyle: React.CSSProperties = { padding: '8px 10px', color: 'var(--ks-earth)' }
const markPaidBtn: React.CSSProperties = {
  background: 'var(--ks-jade)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 11px',
  fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
}

export default function AdminSaathiPage() {
  return (
    <RequireAdmin>
      <AdminSaathiInner />
    </RequireAdmin>
  )
}
