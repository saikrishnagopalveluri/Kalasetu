-- Hastkatha — track when a product row was last edited.
-- Needed so "content created this week" (gamification) can tell whether a
-- product's description/craft story was written recently, not just whether
-- the product itself was first added recently.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

alter table products add column if not exists updated_at timestamptz default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on products;
create trigger set_products_updated_at before update on products
  for each row execute function public.set_updated_at();
