# Applying Session 8

One migration this session — the `submissions` table catches up to the
room-types shape `hostels` has had since Session 4.5/5. The table has
never had a real row written to it (the Submit form didn't exist until
now), so this is a clean shape change: no backfill, no dependent views or
functions to juggle around a drop.

## 1. Apply the migration

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run the contents of
`supabase/migrations/20260703143901_submissions_room_types_shape.sql`:

```sql
alter table public.submissions add column room_types jsonb not null default '[]'::jsonb;
alter table public.submissions add column price_min numeric;
alter table public.submissions add column price_max numeric;
alter table public.submissions add column call_number text;

alter table public.submissions drop column images;
alter table public.submissions add column images jsonb not null default '[]'::jsonb;

alter table public.submissions alter column location set not null;
alter table public.submissions alter column contact set not null;

create trigger maintain_submission_price_range
  before insert or update of room_types on public.submissions
  for each row execute function public.maintain_hostel_price_range();

alter table public.submissions drop column price;
alter table public.submissions drop column room_type;
alter table public.submissions drop column room_images;
```

No Storage or Auth dashboard changes this session — the image-cleanup fix
(deleting a removed photo from Storage, not just the form array) runs
entirely through the existing owner-scoped Storage RLS from Session 2.

## 2. Verify

- Sign out, hit `/submit` — should show "Sign in to submit a hostel" and
  open the auth sheet; after signing in, the real form should appear in
  place (no separate redirect needed).
- Add two room types with different prices/photos — the "Students will
  see: GHS X – Y / year" preview should update live. Try adding the same
  type twice — the second add button should simply not offer an
  already-used type.
- Try submitting with no room types, no name, no WhatsApp number — each
  should show a friendly inline error, no raw error dump.
- Enter a WhatsApp number as `024 000 0000`, submit — confirm in the SQL
  editor it was stored normalized: `select contact from public.submissions
  order by created_at desc limit 1;` should show `233240000000`.
- Check "Call number is the same as WhatsApp" — the call field should
  mirror WhatsApp and grey out.
- Upload a photo, then remove it before submitting — confirm it's actually
  gone from Storage (Storage browser in the dashboard, `hostel-images` or
  `room-images` bucket), not just gone from the form.
- Submit a complete form — should show "Submitted!", and the new row
  should appear in Profile → My Submissions with a **Pending** badge.
- Confirm `submissions.price_min`/`price_max` were computed automatically
  by the trigger (don't set them from the app):
  `select room_types, price_min, price_max from public.submissions order
  by created_at desc limit 1;`
