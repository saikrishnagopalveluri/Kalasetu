import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/requireUser'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Impact stats aggregate across the artisans a Saathi has referred — e.g.
// "37 products digitised" — which needs each referred artisan's own product
// count and catalogue status. A Saathi's own RLS session can't read that
// (regular users only ever see their own products/catalogue state; see
// supabase/007_admin.sql), so this runs server-side with the service role,
// after confirming who the caller is, and returns only aggregate counts and
// coarse status — never a referred artisan's actual private content.

function generateCode(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'artisan'
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}${suffix}`
}

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const auth = await requireUser(request)
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const userId = auth.userId

  const { data: profile } = await supabaseAdmin.from('artisan_profiles').select('referral_code, name').eq('id', userId).maybeSingle()
  let referralCode = profile?.referral_code ?? null
  if (!referralCode) {
    referralCode = generateCode(profile?.name ?? '')
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabaseAdmin.from('artisan_profiles').update({ referral_code: referralCode }).eq('id', userId)
      if (!error) break
      referralCode = generateCode((profile?.name ?? '') + attempt)
    }
  }

  const { data: referrals } = await supabaseAdmin
    .from('saathi_referrals').select('id, status, referred_user_id, created_at').eq('saathi_id', userId).order('created_at', { ascending: false })
  const rows = referrals ?? []

  const referredIds = rows.map((r) => r.referred_user_id).filter((id): id is string => !!id)
  const [{ data: referredProfiles }, { data: referredProducts }, { data: rewards }] = await Promise.all([
    referredIds.length > 0
      ? supabaseAdmin.from('artisan_profiles').select('id, name, catalogue_published').in('id', referredIds)
      : Promise.resolve({ data: [] as { id: string; name: string; catalogue_published: boolean }[] }),
    referredIds.length > 0
      ? supabaseAdmin.from('products').select('user_id').in('user_id', referredIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    supabaseAdmin.from('saathi_rewards').select('amount_paise, status').eq('saathi_id', userId),
  ])

  const nameById = new Map((referredProfiles ?? []).map((p) => [p.id, p.name]))
  const catalogueById = new Map((referredProfiles ?? []).map((p) => [p.id, p.catalogue_published]))
  const productCountById = new Map<string, number>()
  for (const row of referredProducts ?? []) productCountById.set(row.user_id, (productCountById.get(row.user_id) ?? 0) + 1)

  const community = rows.map((r) => ({
    name: r.referred_user_id ? (nameById.get(r.referred_user_id) ?? 'Artisan') : 'Artisan',
    status: r.status,
    productsCount: r.referred_user_id ? (productCountById.get(r.referred_user_id) ?? 0) : 0,
    cataloguePublished: r.referred_user_id ? !!catalogueById.get(r.referred_user_id) : false,
  }))

  const empoweredCount = rows.filter((r) => r.status === 'REWARD_UNLOCKED').length
  const activeCount = rows.filter((r) => r.status !== 'INVITED' && r.status !== 'REGISTERED').length
  const totalProducts = [...productCountById.values()].reduce((sum, n) => sum + n, 0)
  const cataloguesCreated = (referredProfiles ?? []).filter((p) => p.catalogue_published).length
  const rewardsEarnedPaise = (rewards ?? []).reduce((sum, r) => sum + r.amount_paise, 0)

  return NextResponse.json({
    referralCode,
    stats: {
      empoweredCount,
      activeCount,
      totalProducts,
      cataloguesCreated,
      rewardsEarnedRupees: Math.round(rewardsEarnedPaise / 100),
    },
    community,
  })
}
