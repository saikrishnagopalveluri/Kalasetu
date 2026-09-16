-- Hastkatha: government schemes, competitions, and trade shows
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Schemes are stable/evergreen and seeded below. Competitions and trade shows
-- are time-bound and meant to be added later via the admin portal (Phase 2).

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  type text not null,          -- 'scheme' | 'competition' | 'tradeshow'
  title text not null unique,
  description text not null,
  official_url text not null,
  deadline date,                -- null for evergreen schemes
  created_at timestamptz default now()
);

alter table opportunities enable row level security;
drop policy if exists "anyone can read opportunities" on opportunities;
create policy "anyone can read opportunities" on opportunities for select using (true);

insert into opportunities (type, title, description, official_url) values
  ('scheme', 'PM Vishwakarma', 'Recognition, skill training with stipend, a toolkit incentive up to ₹15,000, and collateral-free loans up to ₹3 lakh for traditional artisans across 18 trades.', 'https://pmvishwakarma.gov.in'),
  ('scheme', 'Udyam Registration (MSME)', 'Free, paperless registration of your craft business as an MSME. Needed for many scheme applications and loans. Only requires Aadhaar.', 'https://udyamregistration.gov.in'),
  ('scheme', 'Geographical Indication (GI) Registration', 'Protects region-specific crafts (like Pochampally Ikat or Kondapalli toys) from being copied and sold under the same name elsewhere.', 'https://ipindia.gov.in'),
  ('scheme', 'ITPO Trade Fairs', 'India Trade Promotion Organisation: national and international trade fairs and exhibitions where artisans can showcase and sell their work.', 'https://itpo.gov.in')
on conflict (title) do nothing;
