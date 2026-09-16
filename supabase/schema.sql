-- Hastkatha — Phase 1 schema
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- No auth wired up yet, so this stays open (single-artisan pilot). Once login
-- is added, come back and add RLS policies scoped to auth.uid().

create extension if not exists "pgcrypto";

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  material text,
  craft_type text,
  created_at timestamptz default now()
);

create table if not exists generated_content (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  content_type text not null,   -- 'description' | 'caption' | 'whatsapp' | 'catalogue'
  language text not null,       -- 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' | 'mr'
  content text not null,
  created_at timestamptz default now()
);

create index if not exists generated_content_created_at_idx on generated_content (created_at desc);

-- Open access for now — Phase 1 has no login yet.
alter table products enable row level security;
alter table generated_content enable row level security;

drop policy if exists "public read products" on products;
drop policy if exists "public write products" on products;
create policy "public read products" on products for select using (true);
create policy "public write products" on products for insert with check (true);

drop policy if exists "public read generated_content" on generated_content;
drop policy if exists "public write generated_content" on generated_content;
create policy "public read generated_content" on generated_content for select using (true);
create policy "public write generated_content" on generated_content for insert with check (true);
