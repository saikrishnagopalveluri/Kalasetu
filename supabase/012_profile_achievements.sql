-- Hastkatha — rich artisan profile: business identity, about, achievements
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Portfolio reuses the existing `products` table (products with a photo ARE
-- the portfolio) rather than a separate table — avoids duplicating the same
-- image twice for no reason.

alter table artisan_profiles add column if not exists business_name text;
alter table artisan_profiles add column if not exists about text;
alter table artisan_profiles add column if not exists profile_photo_url text;

create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  issuing_organization text,
  year int,
  description text,
  created_at timestamptz default now()
);

alter table achievements enable row level security;

drop policy if exists "read own achievements" on achievements;
create policy "read own achievements" on achievements for select using (auth.uid() = user_id);
drop policy if exists "insert own achievements" on achievements;
create policy "insert own achievements" on achievements for insert with check (auth.uid() = user_id);
drop policy if exists "delete own achievements" on achievements;
create policy "delete own achievements" on achievements for delete using (auth.uid() = user_id);

-- Profile photo storage — same owner-folder pattern as product-images.
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "upload own profile photo" on storage.objects;
create policy "upload own profile photo" on storage.objects
  for insert with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "delete own profile photo" on storage.objects;
create policy "delete own profile photo" on storage.objects
  for delete using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
