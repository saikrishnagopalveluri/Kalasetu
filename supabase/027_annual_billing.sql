-- Hastkatha: support annual (in addition to monthly) subscription billing.
-- subscription_renews_at is what a future renewal-reminder job would query
-- against — not built yet (no email sending infra exists in this project
-- yet), but the data needs to exist from the first annual sale onward, not
-- backfilled later.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

alter table artisan_profiles add column if not exists subscription_period text;
alter table artisan_profiles add column if not exists subscription_renews_at timestamptz;
