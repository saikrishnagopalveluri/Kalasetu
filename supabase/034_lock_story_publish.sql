-- Locks down the community-story publish gate. Previously a signed-in user
-- could insert (or update) their own `stories` row with status='PUBLISHED'
-- and a self-reported ai_scores object straight from the browser — RLS only
-- ever checked auth.uid() = author_id, never status or score. The AI
-- quality gate (score >= 8 to publish) was enforced only in the client UI.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Fix: an author may still insert/update their own DRAFT or PENDING_REVIEW
-- rows directly (unchanged), but can never write status='PUBLISHED' from
-- the client. Only app/api/story-publish/route.ts (service-role, after
-- independently re-running the AI evaluation server-side) can publish a
-- story now — the same "server re-verifies, never trusts the client"
-- pattern already used for Saathi referrals and Razorpay payments.

drop policy if exists "author writes own stories" on stories;
create policy "author writes own stories" on stories
  for insert with check (auth.uid() = author_id and status <> 'PUBLISHED');

drop policy if exists "author updates own stories" on stories;
create policy "author updates own stories" on stories
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id and status <> 'PUBLISHED');

-- Admin moderation policy is untouched — admins can still set any status,
-- including manually publishing or unpublishing a story, via public.is_admin().
