-- KalaSetu recognition badges — a gamified, platform-earned system,
-- deliberately separate from `achievements` (supabase/012_profile_achievements.sql),
-- which is a résumé-style list of an artisan's own real-world credentials
-- (award title, issuing organization, year). The two are shown as distinct
-- sections on the profile page and should never be conflated.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists badges (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null
);

alter table badges enable row level security;
drop policy if exists "anyone can read badges" on badges;
create policy "anyone can read badges" on badges for select using (true);

insert into badges (id, name, description, icon) values
  ('storyteller', 'Storyteller', 'Published 5 stories', 'IconContent'),
  ('cultural_keeper', 'Cultural Keeper', 'Published a story documenting traditional craft knowledge', 'IconOpportunities'),
  ('community_star', 'Community Star', 'Received strong community engagement on a story', 'IconPromote'),
  ('kalasetu_saathi', 'Saathi', 'Successfully empowered another artisan', 'IconSaathi'),
  ('mentor', 'Mentor', 'Consistently helped other artisans join and grow', 'IconSaathi'),
  ('digital_artisan', 'Digital Artisan', 'Completed digital onboarding and learning milestones', 'IconUpskill'),
  ('master_artisan', 'Master Artisan', 'Reached significant platform milestones', 'IconBadge')
on conflict (id) do nothing;

create table if not exists artisan_badges (
  user_id uuid not null references artisan_profiles(id) on delete cascade,
  badge_id text not null references badges(id) on delete cascade,
  awarded_at timestamptz default now(),
  primary key (user_id, badge_id)
);

alter table artisan_badges enable row level security;
drop policy if exists "anyone can read artisan badges" on artisan_badges;
create policy "anyone can read artisan badges" on artisan_badges for select using (true);
-- No insert/update policy for regular users — badges are awarded only
-- server-side (supabaseAdmin), the moment the earning event happens.
drop policy if exists "admins manage artisan badges" on artisan_badges;
create policy "admins manage artisan badges" on artisan_badges for all using (public.is_admin());
