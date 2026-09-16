-- Hastkatha — CRITICAL SECURITY FIX
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Run this one as soon as possible.
--
-- Bug: the "update own profile" policy on artisan_profiles lets a user
-- update ANY column on their own row, including is_admin and
-- subscription_tier — row-level security restricts which ROWS you can
-- touch, not which COLUMNS. Any logged-in user could currently run:
--   supabase.from('artisan_profiles').update({ is_admin: true }).eq('id', user.id)
-- and grant themselves admin access. This trigger closes that gap: a
-- non-admin's update silently keeps the old is_admin/subscription_tier
-- values no matter what they send, while admins (and the payment
-- verification route, once it exists) can still change them.

create or replace function public.protect_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins (via the app's admin portal) and the service-role key (used by
  -- trusted server-side routes, e.g. payment verification) may change
  -- these columns. Every other caller — including the row's own owner —
  -- gets their submitted values silently discarded, keeping the old ones.
  if not (public.is_admin() or auth.role() = 'service_role') then
    new.is_admin := old.is_admin;
    new.subscription_tier := old.subscription_tier;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_privileged_columns_trigger on artisan_profiles;
create trigger protect_privileged_columns_trigger
  before update on artisan_profiles
  for each row execute function public.protect_privileged_columns();
