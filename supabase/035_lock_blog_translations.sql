-- blog_translations previously granted insert/update to ANY authenticated
-- user with check(true) — no ownership or admin check at all, unlike the
-- blogs table itself (admin-gated). Any signed-in artisan could overwrite
-- any language's cached translation of any public post, and it would be
-- served straight to readers from cache.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Fix: only admins and the server-side translation pipeline (which uses
-- supabaseAdmin, the service-role key that bypasses RLS entirely — see
-- app/api/blog-translate/route.ts) may write here. Regular users keep
-- read-only access, unchanged.

drop policy if exists "authenticated users can cache blog translations" on blog_translations;
drop policy if exists "authenticated users can update blog translations" on blog_translations;

create policy "admins manage blog translations" on blog_translations
  for insert to authenticated with check (public.is_admin());
create policy "admins update blog translations" on blog_translations
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- app/api/blog-translate/route.ts writes via supabaseAdmin (service role),
-- which bypasses RLS entirely and is unaffected by the policies above.
