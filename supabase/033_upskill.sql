-- KalaSetu Academy (UpSkill) — course structure + progress tracking.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Course/module TEXT lives in lib/translations.ts like the rest of the
-- site's copy (title_key/body_key point at translation keys), not as raw
-- DB text — that's what keeps it inside the same 23-language coverage as
-- everything else, rather than becoming a second, untranslated content
-- system. These tables only store structure, order, and per-user progress.
-- Level 1 reuses the exact lessons already on /learn (app/learn/page.tsx,
-- its LESSONS array and learn.lesson.* keys) so that content isn't
-- duplicated — see app/upskill/page.tsx for how the two are joined.

create table if not exists courses (
  id text primary key,
  level integer not null,
  title_key text not null,
  description_key text not null,
  "order" integer not null
);

alter table courses enable row level security;
drop policy if exists "anyone can read courses" on courses;
create policy "anyone can read courses" on courses for select using (true);

create table if not exists course_modules (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  title_key text not null,
  body_key text,
  "order" integer not null
);

alter table course_modules enable row level security;
drop policy if exists "anyone can read course modules" on course_modules;
create policy "anyone can read course modules" on course_modules for select using (true);

insert into courses (id, level, title_key, description_key, "order") values
  ('level1', 1, 'upskill.level1.title', 'upskill.level1.desc', 1),
  ('level2', 2, 'upskill.level2.title', 'upskill.level2.desc', 2),
  ('level3', 3, 'upskill.level3.title', 'upskill.level3.desc', 3)
on conflict (id) do nothing;

-- Level 1 modules mirror the existing LESSONS array 1:1 (same translation
-- keys already in lib/translations.ts) so nothing is retranslated or forked.
insert into course_modules (id, course_id, title_key, body_key, "order") values
  ('l1-pricing', 'level1', 'learn.lesson.pricing.title', 'learn.lesson.pricing.body', 1),
  ('l1-vishwakarma', 'level1', 'learn.lesson.vishwakarma.title', 'learn.lesson.vishwakarma.body', 2),
  ('l1-whatsapp', 'level1', 'learn.lesson.whatsapp.title', 'learn.lesson.whatsapp.body', 3),
  ('l1-descriptions', 'level1', 'learn.lesson.descriptions.title', 'learn.lesson.descriptions.body', 4),
  ('l1-instagram', 'level1', 'learn.lesson.instagram.title', 'learn.lesson.instagram.body', 5),
  ('l1-protecting', 'level1', 'learn.lesson.protecting.title', 'learn.lesson.protecting.body', 6),
  ('l2-catalogues', 'level2', 'upskill.module.catalogues.title', 'upskill.module.catalogues.body', 1),
  ('l2-social', 'level2', 'upskill.module.social.title', 'upskill.module.social.body', 2),
  ('l2-presentation', 'level2', 'upskill.module.presentation.title', 'upskill.module.presentation.body', 3),
  ('l2-communication', 'level2', 'upskill.module.communication.title', 'upskill.module.communication.body', 4),
  ('l3-branding', 'level3', 'upskill.module.branding.title', 'upskill.module.branding.body', 1),
  ('l3-marketing', 'level3', 'upskill.module.marketing.title', 'upskill.module.marketing.body', 2),
  ('l3-pricingAdvanced', 'level3', 'upskill.module.pricingAdvanced.title', 'upskill.module.pricingAdvanced.body', 3),
  ('l3-selling', 'level3', 'upskill.module.selling.title', 'upskill.module.selling.body', 4),
  ('l3-presence', 'level3', 'upskill.module.presence.title', 'upskill.module.presence.body', 5)
on conflict (id) do nothing;

create table if not exists module_progress (
  user_id uuid not null references artisan_profiles(id) on delete cascade,
  module_id text not null references course_modules(id) on delete cascade,
  completed_at timestamptz default now(),
  primary key (user_id, module_id)
);

alter table module_progress enable row level security;
drop policy if exists "read own module progress" on module_progress;
create policy "read own module progress" on module_progress for select using (auth.uid() = user_id);
drop policy if exists "complete own module" on module_progress;
create policy "complete own module" on module_progress for insert with check (auth.uid() = user_id);
drop policy if exists "delete own module progress" on module_progress;
create policy "delete own module progress" on module_progress for delete using (auth.uid() = user_id);
