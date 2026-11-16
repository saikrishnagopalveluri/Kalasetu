-- Admins previously had no way to delete a story at all (only "admins manage
-- all stories" for update, in 031_community_stories.sql) — needed for
-- moderation, e.g. removing a story that slipped past the AI quality gate
-- or was reported by another user. Admins also had no way to even SEE a
-- DRAFT/PENDING_REVIEW story that wasn't their own — the existing select
-- policies only cover published stories and an author's own — which would
-- have made the new admin Stories moderation tab silently incomplete.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

drop policy if exists "admins delete stories" on stories;
create policy "admins delete stories" on stories for delete using (public.is_admin());

drop policy if exists "admins read all stories" on stories;
create policy "admins read all stories" on stories for select using (public.is_admin());
