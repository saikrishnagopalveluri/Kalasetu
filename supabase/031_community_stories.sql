-- Community / Artisan Stories — user-generated blogging, distinct from the
-- admin/cron-authored `blogs` table (SEO editorial content, untouched).
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references artisan_profiles(id) on delete cascade,
  slug text not null unique,
  title text not null,
  content text not null,
  language text not null default 'en',
  category text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED')),
  ai_scores jsonb,
  ai_feedback text,
  likes_count integer not null default 0,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  reading_time_minutes integer not null default 1,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists stories_published_idx on stories (published_at desc) where status = 'PUBLISHED';
create index if not exists stories_author_id_idx on stories (author_id);

alter table stories enable row level security;

drop policy if exists "anyone can read published stories" on stories;
create policy "anyone can read published stories" on stories for select using (status = 'PUBLISHED');
drop policy if exists "author reads own stories" on stories;
create policy "author reads own stories" on stories for select using (auth.uid() = author_id);
drop policy if exists "author writes own stories" on stories;
create policy "author writes own stories" on stories for insert with check (auth.uid() = author_id);
drop policy if exists "author updates own stories" on stories;
create policy "author updates own stories" on stories for update using (auth.uid() = author_id);
drop policy if exists "author deletes own stories" on stories;
create policy "author deletes own stories" on stories for delete using (auth.uid() = author_id);
drop policy if exists "admins manage all stories" on stories;
create policy "admins manage all stories" on stories for update using (public.is_admin());

-- Same shape as blog_translations (supabase/024_blog_translations.sql) —
-- translate-on-demand, cached forever once generated.
create table if not exists story_translations (
  story_id uuid not null references stories(id) on delete cascade,
  language text not null,
  title text not null,
  content text not null,
  created_at timestamptz default now(),
  primary key (story_id, language)
);

alter table story_translations enable row level security;
drop policy if exists "anyone can read story translations" on story_translations;
create policy "anyone can read story translations" on story_translations for select using (true);

create table if not exists story_likes (
  story_id uuid not null references stories(id) on delete cascade,
  user_id uuid not null references artisan_profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (story_id, user_id)
);

alter table story_likes enable row level security;
drop policy if exists "anyone can read story likes" on story_likes;
create policy "anyone can read story likes" on story_likes for select using (true);
drop policy if exists "user likes with own id" on story_likes;
create policy "user likes with own id" on story_likes for insert with check (auth.uid() = user_id);
drop policy if exists "user unlikes own like" on story_likes;
create policy "user unlikes own like" on story_likes for delete using (auth.uid() = user_id);

create table if not exists story_ratings (
  story_id uuid not null references stories(id) on delete cascade,
  user_id uuid not null references artisan_profiles(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  created_at timestamptz default now(),
  primary key (story_id, user_id)
);

alter table story_ratings enable row level security;
drop policy if exists "anyone can read story ratings" on story_ratings;
create policy "anyone can read story ratings" on story_ratings for select using (true);
drop policy if exists "user rates with own id" on story_ratings;
create policy "user rates with own id" on story_ratings for insert with check (auth.uid() = user_id);
drop policy if exists "user updates own rating" on story_ratings;
create policy "user updates own rating" on story_ratings for update using (auth.uid() = user_id);
