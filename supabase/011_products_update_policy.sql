-- Hastkatha — fix: products had no UPDATE RLS policy, so "Save to product"
-- from the Content page was silently no-op-ing (Supabase returns success
-- with 0 rows affected on a blocked update, not an error, unless the code
-- explicitly checks — which it now does too, see the app fix alongside this).
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

drop policy if exists "update own products" on products;
create policy "update own products" on products for update using (auth.uid() = user_id);
