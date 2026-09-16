-- Hastkatha — government scheme/opportunity ingestion pipeline.
-- Discover -> Fetch -> Extract -> Categorize -> Verify -> Publish.
-- "Discover" is admin-curated (sources are added deliberately below, not
-- auto-crawled) so the pipeline only ever touches URLs a human chose and
-- checks robots.txt before every fetch — see app/api/admin/scrape-schemes.
-- Nothing reaches the public `opportunities` table without an admin approving
-- it in the review queue; this table is the pending-review staging area.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists scheme_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  label text not null,
  category text not null default 'scheme', -- 'scheme' | 'competition' | 'tradeshow'
  active boolean not null default true,
  robots_allowed boolean,        -- null until first checked
  last_content_hash text,
  last_checked_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists scheme_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references scheme_sources(id) on delete cascade,
  content_hash text not null,
  type text not null,
  title text not null,
  description text not null,
  official_url text not null,
  deadline date,
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  fetched_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

alter table scheme_sources enable row level security;
alter table scheme_candidates enable row level security;

create policy "admins manage scheme sources" on scheme_sources for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage scheme candidates" on scheme_candidates for all using (public.is_admin()) with check (public.is_admin());

insert into scheme_sources (url, label, category) values
  ('https://pmvishwakarma.gov.in', 'PM Vishwakarma', 'scheme'),
  ('https://udyamregistration.gov.in', 'Udyam Registration (MSME)', 'scheme'),
  ('https://ipindia.gov.in', 'Geographical Indication (GI) Registration', 'scheme'),
  ('https://itpo.gov.in', 'ITPO Trade Fairs', 'tradeshow')
on conflict (url) do nothing;
