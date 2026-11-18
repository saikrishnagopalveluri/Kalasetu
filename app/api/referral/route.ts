import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject } from '@/lib/readJson'
import { requireUser } from '@/lib/requireUser'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkAndAwardBadges } from '@/lib/badges'
import { BRAND } from '@/lib/brand'

// A referral row touches two different users (the Saathi and the person
// they referred), and the reward it can trigger credits the Saathi's own
// ledger from the referred artisan's session — neither side's RLS policy
// can safely allow that directly, so every write here goes through the
// service-role client after independently confirming who the caller is
// (requireUser), the same trusted-server pattern already used in
// app/api/razorpay/verify/route.ts.

const NEW_ARTISAN_WELCOME_POINTS = 100
const SAATHI_REWARD_PAISE = 10000 // ₹100 — see supabase/030_saathi_rewards.sql for why this is tracked, not auto-paid

type RegisterBody = { action: 'register'; code: string }
type AdvanceBody = { action: 'advance'; stage: 'PROFILE_COMPLETED' | 'FIRST_PRODUCT_COMPLETED' }

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const auth = await requireUser(request)
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const userId = auth.userId

  const body = (await readJsonObject(request)) as RegisterBody | AdvanceBody

  if (body.action === 'register') {
    return handleRegister(userId, body.code)
  }
  if (body.action === 'advance') {
    return handleAdvance(userId, body.stage)
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

async function handleRegister(userId: string, code: string) {
  if (!code || typeof code !== 'string') return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  // Already referred (e.g. a duplicate call) — no-op, not an error, and
  // this is also what the unique constraint on referred_user_id ultimately
  // guards against even if two requests race.
  const { data: existing } = await supabaseAdmin!
    .from('saathi_referrals').select('id').eq('referred_user_id', userId).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, alreadyReferred: true })

  const { data: saathi } = await supabaseAdmin!
    .from('artisan_profiles').select('id').eq('referral_code', code).maybeSingle()
  if (!saathi || saathi.id === userId) {
    // Unknown code, or someone tried to refer themselves — silently ignored,
    // the new account still works fine with no Saathi attached.
    return NextResponse.json({ ok: true, registered: false })
  }

  // A deleted-and-recreated account would otherwise look brand new here —
  // referred_user_id nulls out on account deletion (on delete set null),
  // erasing the fact this person was already referred and rewarded. The
  // email is captured independently of the account row so that history
  // survives account deletion.
  const { data: userData } = await supabaseAdmin!.auth.admin.getUserById(userId)
  const email = userData?.user?.email ?? null
  if (email) {
    const { data: priorByEmail } = await supabaseAdmin!
      .from('saathi_referrals').select('id').eq('referred_email', email).maybeSingle()
    if (priorByEmail) return NextResponse.json({ ok: true, registered: false })
  }

  const { error } = await supabaseAdmin!.from('saathi_referrals').insert({
    saathi_id: saathi.id,
    referred_user_id: userId,
    referred_email: email,
    referral_code: code,
    status: 'REGISTERED',
    registered_at: new Date().toISOString(),
  })
  if (error) {
    console.error('Referral registration failed:', error.message)
    return NextResponse.json({ ok: true, registered: false })
  }
  return NextResponse.json({ ok: true, registered: true })
}

async function handleAdvance(userId: string, stage: AdvanceBody['stage']) {
  if (stage !== 'PROFILE_COMPLETED' && stage !== 'FIRST_PRODUCT_COMPLETED') {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  }

  const { data: referral } = await supabaseAdmin!
    .from('saathi_referrals').select('*').eq('referred_user_id', userId).maybeSingle()
  if (!referral) return NextResponse.json({ ok: true, noReferral: true })
  if (referral.status === 'REWARD_UNLOCKED') return NextResponse.json({ ok: true, alreadyUnlocked: true })

  // The client only tells us WHICH milestone it thinks just happened — it
  // never gets to assert that the milestone is real. A referral is worth
  // real money (see unlockReward below), so every stage is independently
  // re-verified here against its actual source of truth before the column
  // is set, the same principle as Razorpay verify re-checking the order
  // instead of trusting a client-reported "payment succeeded" flag.
  const milestoneReallyHappened = stage === 'PROFILE_COMPLETED'
    ? await hasCompletedProfile(userId)
    : await hasCreatedProduct(userId)
  if (!milestoneReallyHappened) {
    return NextResponse.json({ ok: true, verified: false })
  }

  const column = stage === 'PROFILE_COMPLETED' ? 'profile_completed_at' : 'first_product_at'
  if (!referral[column]) {
    await supabaseAdmin!.from('saathi_referrals').update({
      [column]: new Date().toISOString(),
      status: stage,
    }).eq('id', referral.id)
  }

  const { data: refreshed } = await supabaseAdmin!
    .from('saathi_referrals').select('*').eq('id', referral.id).single()

  const bothMilestonesDone = !!refreshed.profile_completed_at && !!refreshed.first_product_at
  if (bothMilestonesDone && refreshed.status !== 'ONBOARDING_COMPLETED' && refreshed.status !== 'REWARD_UNLOCKED') {
    await supabaseAdmin!.from('saathi_referrals').update({
      status: 'ONBOARDING_COMPLETED',
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', referral.id)
    await unlockReward(referral.id, referral.saathi_id, userId)
  }

  return NextResponse.json({ ok: true })
}

// Same bar app/profile/page.tsx already uses client-side to decide whether
// to even call advanceReferral('PROFILE_COMPLETED') — re-checked here
// server-side because that client call is advisory, not authoritative.
async function hasCompletedProfile(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin!
    .from('artisan_profiles').select('profile_photo_url, about').eq('id', userId).maybeSingle()
  return !!(data?.profile_photo_url && data?.about?.trim())
}

async function hasCreatedProduct(userId: string): Promise<boolean> {
  const { count } = await supabaseAdmin!
    .from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  return (count ?? 0) > 0
}

async function unlockReward(referralId: string, saathiId: string, referredUserId: string) {
  // Unique constraint on saathi_rewards.referral_id makes this idempotent —
  // a retry or a race between two requests can insert at most once.
  const { error: rewardError } = await supabaseAdmin!.from('saathi_rewards').insert({
    referral_id: referralId, saathi_id: saathiId, amount_paise: SAATHI_REWARD_PAISE,
  })
  if (rewardError) {
    if (!rewardError.message.includes('duplicate')) console.error('Saathi reward insert failed:', rewardError.message)
    return
  }

  await supabaseAdmin!.from('saathi_referrals').update({
    status: 'REWARD_UNLOCKED', reward_unlocked_at: new Date().toISOString(),
  }).eq('id', referralId)

  await supabaseAdmin!.from('wallet_transactions').insert({
    user_id: referredUserId, amount: NEW_ARTISAN_WELCOME_POINTS, type: 'WELCOME_BONUS',
    reference_id: referralId, description: `Welcome bonus — empowered by your ${BRAND.name} Saathi`,
  })

  await checkAndAwardBadges(saathiId, 'REFERRAL_REWARD_UNLOCKED')
}
