-- Hastkatha — cached AI translations of blog posts, so every artisan sees
-- blog content in their own language (list titles/summaries included, not
-- just the detail page's old manual picker) without re-translating the same
-- post on every single view.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists blog_translations (
  id uuid primary key default gen_random_uuid(),
  blog_slug text not null references blogs(slug) on delete cascade,
  language text not null,
  title text not null,
  summary text,
  content text,
  created_at timestamptz default now(),
  unique (blog_slug, language)
);

create index if not exists blog_translations_lookup_idx on blog_translations (blog_slug, language);

alter table blog_translations enable row level security;

drop policy if exists "anyone can read blog translations" on blog_translations;
drop policy if exists "authenticated users can cache blog translations" on blog_translations;

-- Public content, same "anyone can read" convention as blogs itself.
create policy "anyone can read blog translations" on blog_translations for select using (true);
-- Any signed-in artisan's browser can be the one that triggers a fresh
-- translation and caches it for everyone after — same trust model already
-- used elsewhere in this app (e.g. products' own public-read setup).
create policy "authenticated users can cache blog translations" on blog_translations
  for insert to authenticated with check (true);
create policy "authenticated users can update blog translations" on blog_translations
  for update to authenticated using (true) with check (true);
