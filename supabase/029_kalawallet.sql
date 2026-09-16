-- KalaWallet — KalaPoints ledger (1 KalaPoint = ₹1, platform credit only).
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- No insert policy for regular users on purpose: every earn/redeem happens
-- server-side (supabaseAdmin, in app/api/referral/* and the redemption path
-- in app/api/razorpay/create-order), after a server-computed balance check —
-- never from a value the client sent. Balance is derived (sum of amount),
-- not stored, so it can never drift from its own transaction history.

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references artisan_profiles(id) on delete cascade,
  amount integer not null,
  type text not null check (type in (
    'WELCOME_BONUS', 'REFERRAL_EMPOWERMENT', 'ONBOARDING_COMPLETE', 'REDEMPTION', 'ADMIN_ADJUSTMENT'
  )),
  reference_id uuid,
  description text not null,
  created_at timestamptz default now()
);

create index if not exists wallet_transactions_user_id_idx on wallet_transactions (user_id, created_at desc);

alter table wallet_transactions enable row level security;

drop policy if exists "read own wallet transactions" on wallet_transactions;
create policy "read own wallet transactions" on wallet_transactions for select using (auth.uid() = user_id);

drop policy if exists "admins read all wallet transactions" on wallet_transactions;
create policy "admins read all wallet transactions" on wallet_transactions for select using (public.is_admin());
