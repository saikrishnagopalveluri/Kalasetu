-- Hastkatha: thumbs up/down feedback on AI-generated images (photoshoot studio
-- and design ideas), plus whatever the artisan typed when asking for
-- something different. Lets the founder see real dissatisfaction patterns
-- instead of guessing at prompt quality.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists generation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,           -- 'photoshoot' | 'design'
  rating text not null,         -- 'up' | 'down'
  prompt text,                  -- the actual prompt sent to the image model, for context
  refine_note text,             -- what the artisan asked to change, if anything
  created_at timestamptz default now()
);

alter table generation_feedback enable row level security;

create policy "insert own feedback" on generation_feedback for insert
  with check (auth.uid() = user_id);
create policy "read own feedback" on generation_feedback for select
  using (auth.uid() = user_id);

-- Admins can review feedback across all users to spot patterns worth fixing.
create policy "admins read all generation_feedback" on generation_feedback
  for select using (public.is_admin());
