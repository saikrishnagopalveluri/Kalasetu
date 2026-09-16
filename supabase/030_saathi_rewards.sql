-- Saathi ₹100 reward ledger — a real, auditable "owed to artisan" record.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- There is no payout rail in this codebase (Razorpay here only takes
-- payments, it doesn't send them), so "PAID" is set by an admin after
-- sending the ₹100 manually (UPI/bank transfer) outside the app — this
-- table exists so that obligation is tracked precisely, not lost, and never
-- silently implied as "already sent" anywhere in the UI.

create table if not exists saathi_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references saathi_referrals(id) on delete cascade,
  saathi_id uuid not null references artisan_profiles(id) on delete cascade,
  amount_paise integer not null default 10000,
  status text not null default 'UNPAID' check (status in ('UNPAID', 'PAID')),
  paid_at timestamptz,
  paid_by uuid references artisan_profiles(id),
  created_at timestamptz default now()
);

create index if not exists saathi_rewards_saathi_id_idx on saathi_rewards (saathi_id);

alter table saathi_rewards enable row level security;

drop policy if exists "read own saathi rewards" on saathi_rewards;
create policy "read own saathi rewards" on saathi_rewards for select using (auth.uid() = saathi_id);

drop policy if exists "admins read all saathi rewards" on saathi_rewards;
create policy "admins read all saathi rewards" on saathi_rewards for select using (public.is_admin());
drop policy if exists "admins update saathi rewards" on saathi_rewards;
create policy "admins update saathi rewards" on saathi_rewards for update using (public.is_admin());
