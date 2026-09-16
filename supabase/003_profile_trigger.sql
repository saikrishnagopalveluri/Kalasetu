-- Hastkatha — auto-create artisan_profiles via trigger instead of a client-side
-- insert. Runs as SECURITY DEFINER so it works even before email confirmation
-- (no client session exists yet at that point, so a client-side insert would
-- fail the RLS check). Signup details are passed in via auth.signUp's
-- `options.data` and read here from raw_user_meta_data.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.artisan_profiles (
    id, name, phone, craft_type, state, preferred_language,
    years_active, income_range, vishwakarma_eligible
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
    new.raw_user_meta_data->>'vishwakarma_eligible'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The client no longer inserts directly, but keep the insert policy in case
-- a profile ever needs to be created client-side (e.g. a future backfill).
