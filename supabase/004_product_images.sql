-- Hastkatha — product images
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

alter table products add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "read own product images" on storage.objects;
drop policy if exists "upload own product images" on storage.objects;
drop policy if exists "delete own product images" on storage.objects;

-- Files are stored as product-images/<user_id>/<filename> — the folder name
-- IS the owner check, same pattern as the row-level policies elsewhere.
create policy "read own product images" on storage.objects
  for select using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "upload own product images" on storage.objects
  for insert with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete own product images" on storage.objects
  for delete using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
