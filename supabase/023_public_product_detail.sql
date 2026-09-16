-- Hastkatha — expose craft_story on the public product view, needed for the
-- new public product detail page (clicking a product on an artisan's
-- published store). product_images itself already has a public-read RLS
-- policy (022_product_gallery.sql) matching the same "public once published"
-- convention products already uses, so no new view is needed for the gallery.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create or replace view public_artisan_products as
select p.id, p.user_id, p.name, p.material, p.craft_type, p.description, p.image_url, p.craft_story
from products p
join artisan_profiles ap on ap.id = p.user_id
where ap.catalogue_published = true and ap.public_slug is not null;

grant select on public_artisan_products to anon, authenticated;
