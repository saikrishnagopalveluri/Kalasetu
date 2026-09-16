-- Hastkatha — public shareable artisan catalogue page (hastkatha.in/a/slug)
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Privacy model: nothing is public until the artisan explicitly publishes.
-- Even then, only a safe subset of fields is exposed via dedicated views —
-- private data (login email, phone used for account/OTP, income_range,
-- vishwakarma_eligible, subscription_tier) is never in these views at all,
-- not just hidden by the frontend. A separate public_contact_phone field
-- lets the artisan choose to share a different, public-facing number if
-- they want an enquiry button — their real account phone stays private.

alter table artisan_profiles add column if not exists public_slug text unique;
alter table artisan_profiles add column if not exists catalogue_published boolean default false;
alter table artisan_profiles add column if not exists public_contact_phone text;

-- Views are owned by the migration role, which owns the underlying tables —
-- table owners bypass RLS by default, so these views can freely select
-- across all rows and apply their own "published only" filter instead.
create or replace view public_artisan_catalogues as
select id, public_slug, name, business_name, about, profile_photo_url,
       craft_type, state, public_contact_phone
from artisan_profiles
where catalogue_published = true and public_slug is not null;

create or replace view public_artisan_products as
select p.id, p.user_id, p.name, p.material, p.craft_type, p.description, p.image_url
from products p
join artisan_profiles ap on ap.id = p.user_id
where ap.catalogue_published = true and ap.public_slug is not null;

create or replace view public_artisan_achievements as
select a.id, a.user_id, a.title, a.issuing_organization, a.year, a.description
from achievements a
join artisan_profiles ap on ap.id = a.user_id
where ap.catalogue_published = true and ap.public_slug is not null;

grant select on public_artisan_catalogues to anon, authenticated;
grant select on public_artisan_products to anon, authenticated;
grant select on public_artisan_achievements to anon, authenticated;
