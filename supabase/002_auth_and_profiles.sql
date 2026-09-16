-- Hastkatha — Auth + artisan profiles migration
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Adds real user accounts and locks down data per-user (replacing the fully
-- open Phase 1 policies now that auth actually exists).

create table if not exists artisan_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  craft_type text,
  state text,
  preferred_language text default 'en',
  years_active int,
  income_range text,           -- self-reported bucket, used for scheme-eligibility signal only
  vishwakarma_eligible text,   -- 'yes' | 'no' | 'unsure' — self-declared, no ID number stored
  subscription_tier text default 'free',
  created_at timestamptz default now()
);

alter table artisan_profiles enable row level security;
drop policy if exists "read own profile" on artisan_profiles;
drop policy if exists "insert own profile" on artisan_profiles;
drop policy if exists "update own profile" on artisan_profiles;
create policy "read own profile" on artisan_profiles for select using (auth.uid() = id);
create policy "insert own profile" on artisan_profiles for insert with check (auth.uid() = id);
create policy "update own profile" on artisan_profiles for update using (auth.uid() = id);

-- Attach existing tables to real users
alter table products add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table generated_content add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists products_user_id_idx on products (user_id);
create index if not exists generated_content_user_id_idx on generated_content (user_id);

-- Replace the open Phase-1 policies with per-user scoping
drop policy if exists "public read products" on products;
drop policy if exists "public write products" on products;
create policy "read own products" on products for select using (auth.uid() = user_id);
create policy "insert own products" on products for insert with check (auth.uid() = user_id);

drop policy if exists "public read generated_content" on generated_content;
drop policy if exists "public write generated_content" on generated_content;
create policy "read own generated_content" on generated_content for select using (auth.uid() = user_id);
create policy "insert own generated_content" on generated_content for insert with check (auth.uid() = user_id);
