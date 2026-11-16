// Server-only KalaWallet helpers. Import only from API routes (uses
// supabaseAdmin) — never from client components, since redeem() must never
// trust a client-supplied balance. Balance is always the sum of a user's
// own transaction history, never a separately stored number that could
// drift from it.
import { supabaseAdmin } from './supabaseAdmin'

export async function getBalance(userId: string): Promise<number> {
  if (!supabaseAdmin) return 0
  const { data } = await supabaseAdmin.from('wallet_transactions').select('amount').eq('user_id', userId)
  return (data ?? []).reduce((sum, row) => sum + row.amount, 0)
}

export async function earn(
  userId: string,
  amount: number,
  type: 'WELCOME_BONUS' | 'REFERRAL_EMPOWERMENT' | 'ONBOARDING_COMPLETE' | 'ADMIN_ADJUSTMENT',
  description: string,
  referenceId?: string
) {
  if (!supabaseAdmin || amount <= 0) return
  await supabaseAdmin.from('wallet_transactions').insert({
    user_id: userId, amount, type, description, reference_id: referenceId ?? null,
  })
}

// Never lets a balance go negative. The balance check and the debit insert
// happen as one atomic, per-user-locked operation inside
// redeem_kalapoints() (see supabase/037_atomic_wallet_redeem.sql) — a plain
// read-then-write here would leave a race where two concurrent redemptions,
// each individually valid against the same starting balance, could both
// succeed and take the balance negative.
export async function redeem(userId: string, amount: number, description: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseAdmin) return { ok: false, error: 'Not configured' }
  if (amount <= 0) return { ok: false, error: 'Invalid amount' }
  const { data, error } = await supabaseAdmin.rpc('redeem_kalapoints', {
    p_user_id: userId, p_amount: amount, p_description: description,
  })
  if (error) return { ok: false, error: 'Redemption failed' }
  if (!data) return { ok: false, error: 'Insufficient KalaPoints' }
  return { ok: true }
}
