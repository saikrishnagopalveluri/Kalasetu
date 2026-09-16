-- Hastkatha: publish a built catalogue (from /catalogue) as a shareable
-- webpage at hastkatha.in/c/slug, with per-product WhatsApp enquiry buttons.
--
-- Each publish captures a snapshot (title/products/labels/artisan info) at
-- that moment, the same way the existing PDF/PPT/DOCX exports already work,
-- rather than live-syncing against the products table forever. That also
-- keeps the public read simple: no join against a private table is needed,
-- the row itself is the complete public payload.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists catalogues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null,
  template text not null,
  language text not null default 'en',
  business_name text not null,
  contact_phone text,
  data jsonb not null,
  published boolean not null default true,
  created_at timestamptz default now()
);

alter table catalogues enable row level security;

create policy "owner manages own catalogues" on catalogues for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "anyone can read published catalogues" on catalogues for select
  using (published = true);
