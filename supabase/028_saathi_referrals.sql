-- KalaSetu Saathi — artisan-to-artisan referral programme.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Writes to this table only ever happen server-side (via supabaseAdmin in
-- app/api/referral/*), never directly from the client, because a referral
-- row touches two different users' data (the Saathi and the person they
-- referred) — something a per-user RLS policy can't safely allow either way.

alter table artisan_profiles add column if not exists referral_code text unique;

create table if not exists saathi_referrals (
  id uuid primary key default gen_random_uuid(),
  saathi_id uuid not null references artisan_profiles(id) on delete cascade,
  referred_user_id uuid unique references artisan_profiles(id) on delete set null,
  referral_code text not null,
  status text not null default 'INVITED' check (status in (
    'INVITED', 'REGISTERED', 'PROFILE_COMPLETED', 'FIRST_PRODUCT_COMPLETED',
    'ONBOARDING_COMPLETED', 'REWARD_UNLOCKED'
  )),
  registered_at timestamptz,
  profile_completed_at timestamptz,
  first_product_at timestamptz,
  onboarding_completed_at timestamptz,
  reward_unlocked_at timestamptz,
  created_at timestamptz default now(),
  constraint no_self_referral check (saathi_id != referred_user_id)
);

create index if not exists saathi_referrals_saathi_id_idx on saathi_referrals (saathi_id);

alter table saathi_referrals enable row level security;

-- Both sides of a referral can read it; only the server (service role,
-- which bypasses RLS entirely) writes to it.
drop policy if exists "read own referrals as saathi" on saathi_referrals;
create policy "read own referrals as saathi" on saathi_referrals for select using (auth.uid() = saathi_id);
drop policy if exists "read own referral as referred" on saathi_referrals;
create policy "read own referral as referred" on saathi_referrals for select using (auth.uid() = referred_user_id);

drop policy if exists "admins read all referrals" on saathi_referrals;
create policy "admins read all referrals" on saathi_referrals for select using (public.is_admin());
