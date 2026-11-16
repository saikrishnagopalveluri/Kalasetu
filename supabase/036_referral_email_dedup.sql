-- Mitigates delete-and-recreate farming of Saathi referral rewards: today,
-- referred_user_id is set to NULL when an account is deleted (on delete set
-- null), which erases any record that a given real person was already
-- referred and rewarded — they can sign up again under the same code and
-- farm another reward. Combined with the server-side milestone verification
-- added in app/api/referral/route.ts, this makes repeat-farming require a
-- genuinely new email each time, not just a new account.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

alter table saathi_referrals add column if not exists referred_email text;

-- Backfill is not attempted here — existing rows simply have no
-- referred_email until the next time this code path runs for them, which is
-- fine since dedup only needs to catch NEW registrations going forward.
