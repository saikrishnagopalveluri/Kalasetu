-- Hastkatha: consent audit trail for DPDPA / GDPR compliance.
--
-- The signup form already blocks submission until the artisan checks
-- "I agree to Terms of Service and Privacy Policy," but that checkbox state
-- was never persisted anywhere: once the account existed, there was no
-- record of *when* (or under which policy version) consent was given.
-- Both India's DPDP Act and GDPR expect a fiduciary/controller to be able to
-- demonstrate consent, not just assert it happened.
--
-- Since handle_new_user() only fires once, at the exact moment a new account
-- is created (which the client-side checkbox already gates), the row's own
-- creation instant IS the consent instant — no need to thread anything new
-- through the client. Just stamp it here.
--
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

alter table artisan_profiles add column if not exists terms_accepted_at timestamptz;
alter table artisan_profiles add column if not exists terms_version text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.artisan_profiles (
    id, name, phone, craft_type, state, preferred_language,
    years_active, income_range, vishwakarma_eligible,
    terms_accepted_at, terms_version
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Artisan'),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'craft_type',
    new.raw_user_meta_data->>'state',
    coalesce(new.raw_user_meta_data->>'preferred_language', 'en'),
    nullif(new.raw_user_meta_data->>'years_active', '')::int,
    new.raw_user_meta_data->>'income_range',
    new.raw_user_meta_data->>'vishwakarma_eligible',
    now(),
    '2026-09'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Existing accounts predate this column and are left null — their consent
-- was already captured by the signup flow's checkbox at the time, we simply
-- weren't recording the timestamp. Not retroactively guessable, left honest.
