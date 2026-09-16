-- Hastkatha — AI Design Inspiration tool: saved design ideas + their reference images.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists design_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  craft_type text not null,
  theme text not null,
  notes text,
  design_idea text not null,
  design_direction text not null,
  story text not null,
  fact_note text,
  interpretation_note text not null,
  image_url text,
  created_at timestamptz default now()
);

alter table design_ideas enable row level security;

create policy "read own design ideas" on design_ideas for select using (auth.uid() = user_id);
create policy "insert own design ideas" on design_ideas for insert with check (auth.uid() = user_id);
create policy "delete own design ideas" on design_ideas for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('design-images', 'design-images', true)
on conflict (id) do nothing;

create policy "read design images" on storage.objects for select using (bucket_id = 'design-images');
create policy "upload own design images" on storage.objects for insert
  with check (bucket_id = 'design-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own design images" on storage.objects for delete
  using (bucket_id = 'design-images' and (storage.foldername(name))[1] = auth.uid()::text);
