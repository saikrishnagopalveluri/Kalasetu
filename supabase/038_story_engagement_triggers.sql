-- stories.likes_count / rating_sum / rating_count were never reconciled
-- from real story_likes / story_ratings activity — the UI's optimistic
-- client-side counters were the only thing showing a number, and it reset
-- on reload. This also meant the "Community Star" badge condition
-- (>=25 likes or 4.5+ avg with 10+ ratings, see lib/badges.ts) could never
-- be earned through genuine engagement.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Fix: triggers recompute the real aggregate on stories whenever a like or
-- rating is added, changed, or removed.

create or replace function recompute_story_likes()
returns trigger
language plpgsql
as $$
declare
  v_story_id uuid := coalesce(new.story_id, old.story_id);
begin
  update stories set likes_count = (
    select count(*) from story_likes where story_id = v_story_id
  ) where id = v_story_id;
  return null;
end;
$$;

drop trigger if exists story_likes_recompute on story_likes;
create trigger story_likes_recompute
  after insert or delete on story_likes
  for each row execute function recompute_story_likes();

create or replace function recompute_story_ratings()
returns trigger
language plpgsql
as $$
declare
  v_story_id uuid := coalesce(new.story_id, old.story_id);
begin
  update stories set
    rating_sum = (select coalesce(sum(stars), 0) from story_ratings where story_id = v_story_id),
    rating_count = (select count(*) from story_ratings where story_id = v_story_id)
  where id = v_story_id;
  return null;
end;
$$;

drop trigger if exists story_ratings_recompute on story_ratings;
create trigger story_ratings_recompute
  after insert or update or delete on story_ratings
  for each row execute function recompute_story_ratings();
