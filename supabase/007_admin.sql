-- Hastkatha — admin role + cross-user access for admins
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- After running, promote yourself: see the UPDATE at the bottom (commented).

alter table artisan_profiles add column if not exists is_admin boolean default false;

-- Helper used by RLS policies below — checks the CURRENT user's own admin
-- flag. security definer so it can read artisan_profiles even under RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from artisan_profiles where id = auth.uid()), false);
$$;

-- Admins can read every profile (not just their own) — needed for the
-- artisan management portal.
drop policy if exists "admins read all profiles" on artisan_profiles;
create policy "admins read all profiles" on artisan_profiles
  for select using (public.is_admin());

-- Admins can update any profile (e.g. change subscription tier).
drop policy if exists "admins update all profiles" on artisan_profiles;
create policy "admins update all profiles" on artisan_profiles
  for update using (public.is_admin());

-- Admins can manage blogs and opportunities (everyone can still read them —
-- see the "anyone can read" policies from earlier migrations).
drop policy if exists "admins write blogs" on blogs;
create policy "admins write blogs" on blogs for insert with check (public.is_admin());
drop policy if exists "admins update blogs" on blogs;
create policy "admins update blogs" on blogs for update using (public.is_admin());
drop policy if exists "admins delete blogs" on blogs;
create policy "admins delete blogs" on blogs for delete using (public.is_admin());

drop policy if exists "admins write opportunities" on opportunities;
create policy "admins write opportunities" on opportunities for insert with check (public.is_admin());
drop policy if exists "admins update opportunities" on opportunities;
create policy "admins update opportunities" on opportunities for update using (public.is_admin());
drop policy if exists "admins delete opportunities" on opportunities;
create policy "admins delete opportunities" on opportunities for delete using (public.is_admin());

-- Admins can read usage data across all users for the analytics dashboard.
drop policy if exists "admins read all products" on products;
create policy "admins read all products" on products for select using (public.is_admin());
drop policy if exists "admins read all generated_content" on generated_content;
create policy "admins read all generated_content" on generated_content for select using (public.is_admin());

-- ── After running the above, make yourself an admin ──────────────────────
-- Find your user id in Authentication -> Users (copy the UUID), then run:
--   update artisan_profiles set is_admin = true where id = 'paste-your-uuid-here';
