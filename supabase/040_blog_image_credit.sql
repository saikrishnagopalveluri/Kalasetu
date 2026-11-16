-- Header images now come from a real photo search (Wikimedia Commons)
-- instead of AI generation, per the user's request that blog images be
-- real, relatable photographs rather than generated ones. Most Commons
-- photos are under a license (e.g. CC-BY-SA) that requires attribution,
-- so the credit line travels with the post rather than being looked up
-- again at render time.
alter table blogs add column if not exists image_credit text;
