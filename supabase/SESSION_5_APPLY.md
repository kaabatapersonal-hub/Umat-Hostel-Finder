# Applying the Session 5 migration

One migration: `supabase/migrations/20260702231149_image_blur_placeholders.sql`.
It changes `hostels.images` from a plain `text[]` to a `jsonb` array of
`{ url, blurDataURL }` objects (so each image can carry its own blur
placeholder), and does the same inside every `room_types[].images` entry.
Existing seeded URLs get `blurDataURL: null` — the app already handles that
gracefully (falls back to a brand-tinted shimmer instead of a true blur).

**Note:** if you tried this earlier and got `0A000: cannot use subquery in
transform expression` — that was a bug in the first draft (Postgres doesn't
allow a subquery inside `ALTER COLUMN ... USING`). It failed as one
transaction and rolled back cleanly, so nothing was left half-applied. The
SQL below is the fixed version (add-column → backfill via `UPDATE` →
drop-old → rename, instead of `ALTER COLUMN TYPE ... USING`).

## 1. Apply the migration

Open the [SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run:

```sql
-- Session 5: every stored image URL now travels with its blur placeholder
-- (a tiny base64 blurDataURL generated at upload time), so SmartImage can
-- blur-up with zero extra network round-trips. That means `images` can no
-- longer be a plain array of URL strings — both hostels.images and each
-- room_types[].images become arrays of { url, blurDataURL } objects.
--
-- Existing rows (seeded with plain URL strings, no blur data yet) get
-- blurDataURL: null — SmartImage falls back to a brand-tinted shimmer for
-- those until they're re-uploaded through the real pipeline.
--
-- get_hostel_feed() declares `images text[]` in its return type and reads
-- h.images directly, so it has to be dropped before hostels.images changes
-- shape and recreated after — same reasoning as the price_min/price_max
-- migration in Session 4.5.

-- 1. Drop the function that depends on hostels.images' old type.
drop function if exists public.get_hostel_feed(
  text, boolean, boolean, boolean, boolean, boolean, boolean, timestamptz, uuid, int
);

-- 2. hostels.images: text[] -> jsonb array of { url, blurDataURL }. Postgres
-- doesn't allow a subquery inside an ALTER COLUMN ... USING expression
-- (error 0A000), so this goes via add-column -> backfill -> drop -> rename
-- instead of a single ALTER COLUMN TYPE.
alter table public.hostels add column images_new jsonb not null default '[]'::jsonb;

update public.hostels
set images_new = coalesce(
  (select jsonb_agg(jsonb_build_object('url', img, 'blurDataURL', null)) from unnest(images) as img),
  '[]'::jsonb
);

alter table public.hostels drop column images;
alter table public.hostels rename column images_new to images;

-- 3. room_types[].images: string[] -> array of { url, blurDataURL }, inside
-- the existing room_types jsonb column. Harmlessly re-fires
-- maintain_hostel_price_range (price itself is untouched).
update public.hostels
set room_types = (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type', rt ->> 'type',
        'price', (rt ->> 'price')::numeric,
        'images', (
          select coalesce(jsonb_agg(jsonb_build_object('url', img, 'blurDataURL', null)), '[]'::jsonb)
          from jsonb_array_elements_text(rt -> 'images') as img
        )
      )
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(room_types) as rt
);

-- 4. Recreate get_hostel_feed() with images jsonb instead of text[].
create function public.get_hostel_feed(
  p_search text default null,
  p_near_campus boolean default false,
  p_under_budget boolean default false,
  p_available_now boolean default false,
  p_featured_only boolean default false,
  p_en_suite boolean default false,
  p_cursor_featured boolean default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 10
)
returns table (
  id uuid,
  name text,
  price_min numeric,
  price_max numeric,
  location text,
  distance_text text,
  images jsonb,
  tags text[],
  availability text,
  rating_avg numeric,
  rating_count integer,
  featured boolean,
  featured_until timestamptz,
  created_at timestamptz,
  is_actively_featured boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    h.id,
    h.name,
    h.price_min,
    h.price_max,
    h.location,
    h.distance_text,
    h.images,
    h.tags,
    h.availability,
    h.rating_avg,
    h.rating_count,
    h.featured,
    h.featured_until,
    h.created_at,
    (h.featured and (h.featured_until is null or h.featured_until > now())) as is_actively_featured
  from public.hostels h
  where
    (p_search is null or p_search = '' or h.name ilike '%' || p_search || '%' or h.location ilike '%' || p_search || '%')
    and (not p_near_campus or h.tags @> array['near_campus'])
    and (not p_under_budget or h.price_min < 2000)
    and (not p_available_now or h.availability = 'available')
    and (not p_featured_only or (h.featured and (h.featured_until is null or h.featured_until > now())))
    and (not p_en_suite or h.facilities @> array['en_suite'] or h.tags @> array['en_suite'])
    and (
      p_cursor_created_at is null
      or (
        (h.featured and (h.featured_until is null or h.featured_until > now())),
        h.created_at,
        h.id
      ) < (
        coalesce(p_cursor_featured, false),
        p_cursor_created_at,
        p_cursor_id
      )
    )
  order by is_actively_featured desc, h.created_at desc, h.id desc
  limit p_limit;
$$;

grant execute on function public.get_hostel_feed to anon, authenticated;
```

## 2. Verify

- `npm run dev`, open `/` and a details page — should render exactly as
  before (existing picsum URLs still work, just without true blur-up yet).
- Open `/kitchen-sink`, scroll to "Image pipeline (dev test)". Sign in with
  a test user (see below), pick a large photo, and confirm: a compressed
  thumbnail appears with a progress percentage, it finishes at a few
  hundred KB, and the resulting URL is a real `hostel-images` Storage URL
  with a `blurDataURL` populated.
- The "SmartImage" section above it shows blur-up, the no-image branded
  fallback, and the broken-URL fallback side by side.

## 3. Test user for the upload harness

Storage RLS requires an authenticated caller (`hostel_images_authenticated_insert`
policy from Session 2). The kitchen-sink harness needs to sign in as
*someone* — reuse one of the two test users you created in Session 2 for
the review-trigger test, or create a fresh one via Dashboard → Authentication
→ Add user. Either way, I don't have the password — you'll need to sign in
through the kitchen-sink form yourself (or tell me the credentials if you'd
like me to drive the verification).
