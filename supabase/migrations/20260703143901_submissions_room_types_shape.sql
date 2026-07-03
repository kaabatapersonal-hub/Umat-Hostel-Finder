-- Session 8: submissions has been sitting with the OLD single
-- price/room_type/room_images shape since before Session 4.5 restructured
-- hostels into room_types + price_min/price_max, and before Session 5
-- turned every images array into { url, blurDataURL } objects. Nothing has
-- ever written to this table (the Submit form didn't exist until now), so
-- this is a clean shape change with no data to backfill or functions to
-- juggle around a drop -- unlike the equivalent hostels migrations.
--
-- The goal is for submissions and hostels to share the same field shapes,
-- so Session 11's admin-approval step can copy a submission straight into
-- a new hostels row.

-- 1. New columns, matching hostels exactly.
alter table public.submissions add column room_types jsonb not null default '[]'::jsonb;
alter table public.submissions add column price_min numeric;
alter table public.submissions add column price_max numeric;
alter table public.submissions add column call_number text;

-- 2. images: text[] -> jsonb array of { url, blurDataURL }, same shape as
-- hostels.images since Session 5. The table is empty, so this is a
-- straight drop-and-recreate rather than the backfill dance Session 5 had
-- to do on hostels' real data.
alter table public.submissions drop column images;
alter table public.submissions add column images jsonb not null default '[]'::jsonb;

-- 3. name/location/contact are all required on hostels; submissions should
-- require the same before a listing can go to review.
alter table public.submissions alter column location set not null;
alter table public.submissions alter column contact set not null;

-- 4. Reuse the same trigger function hostels uses to keep price_min/
-- price_max in sync with room_types -- it only ever reads/writes NEW's
-- room_types/price_min/price_max columns, so it works unmodified on any
-- table with that shape.
create trigger maintain_submission_price_range
  before insert or update of room_types on public.submissions
  for each row execute function public.maintain_hostel_price_range();

-- 5. Drop the old single-room-type columns now that room_types replaces
-- them. This also drops the room_type CHECK constraint automatically.
alter table public.submissions drop column price;
alter table public.submissions drop column room_type;
alter table public.submissions drop column room_images;
