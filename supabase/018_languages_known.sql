-- Hastkatha: languages an artisan speaks/reads/writes, shown on their public
-- page so a buyer knows whether they can communicate with the artisan.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

alter table artisan_profiles add column if not exists languages_known text[];

-- Re-create the public view (migration 013) to also expose languages_known.
create or replace view public_artisan_catalogues as
select id, public_slug, name, business_name, about, profile_photo_url,
       craft_type, state, public_contact_phone, languages_known
from artisan_profiles
where catalogue_published = true and public_slug is not null;

grant select on public_artisan_catalogues to anon, authenticated;
