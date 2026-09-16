-- Hastkatha — Learn page videos
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Curated, verified real YouTube videos (not scraped) — more can be added
-- via the admin portal (Artisans & Content -> Videos).

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  youtube_id text not null unique,
  title text not null,
  language text not null,     -- language of the video's spoken content
  category text not null,     -- 'schemes' | 'marketing' | 'pricing' | 'inspiration'
  created_at timestamptz default now()
);

alter table videos enable row level security;
drop policy if exists "anyone can read videos" on videos;
create policy "anyone can read videos" on videos for select using (true);

drop policy if exists "admins write videos" on videos;
create policy "admins write videos" on videos for insert with check (public.is_admin());
drop policy if exists "admins delete videos" on videos;
create policy "admins delete videos" on videos for delete using (public.is_admin());

insert into videos (youtube_id, title, language, category) values
  ('Q7nDHdU0oY0', 'PM Vishwakarma Yojana — Eligibility and How to Apply', 'hi', 'schemes'),
  ('lvFkjhUq-OM', 'Instagram Marketing Full Course for Beginners', 'hi', 'marketing'),
  ('OqCvIVCgbs8', 'How to Price Handmade Crafts So They Sell and Make Profit', 'en', 'pricing'),
  ('4CB7WsAYQD8', 'Successful Secrets of a Handicraft Business', 'hi', 'inspiration')
on conflict (youtube_id) do nothing;
