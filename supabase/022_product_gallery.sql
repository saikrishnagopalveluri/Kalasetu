-- Hastkatha — product delete policy fix + multi-image product gallery
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- products had no DELETE RLS policy (same class of bug as the missing UPDATE
-- policy fixed in 011): deletes were silently no-op-ing, returning success
-- with 0 rows affected instead of an error.
drop policy if exists "delete own products" on products;
create policy "delete own products" on products for delete using (auth.uid() = user_id);

-- Additional gallery images per product, beyond the single cover `image_url`
-- column on products itself (kept as-is so every existing consumer —
-- catalogue templates, public pages — keeps working unchanged). `position`
-- orders the gallery/banner strip on the product detail page.
create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  image_url text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create index if not exists product_images_product_id_idx on product_images (product_id, position);

alter table product_images enable row level security;

drop policy if exists "public read product images" on product_images;
drop policy if exists "manage own product images" on product_images;

-- Mirrors products' own "public read / owner write" split so published
-- catalogue and public profile pages can still show the gallery.
create policy "public read product images" on product_images for select using (true);
create policy "manage own product images" on product_images for all using (
  exists (select 1 from products where products.id = product_images.product_id and products.user_id = auth.uid())
) with check (
  exists (select 1 from products where products.id = product_images.product_id and products.user_id = auth.uid())
);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
