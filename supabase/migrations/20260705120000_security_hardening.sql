-- Session 15: security audit fixes. Every change here is additive/
-- tightening only -- nothing here removes a capability any legitimate
-- user (student, owner, or admin) currently relies on; verified against
-- every real read/write path in the app before writing this (see
-- SECURITY.md for the reasoning behind each one).

-- 1. CRITICAL: profiles' SELECT policy was `using (true)` -- any anon or
-- authenticated request could read every user's email and role. Every
-- legitimate read of another user's profile in the app is already
-- admin-gated (checked against every `.from("profiles")` call site);
-- reviews display names via reviews.reviewer_name (denormalized at
-- insert time), never a live profiles join. Tightening this to
-- "your own row, or an admin" removes the harvesting vector with zero
-- feature loss.
drop policy "profiles_select_all" on public.profiles;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- 2. HIGH: storage buckets had no server-side MIME allow-list or size
-- cap -- the client compresses to WebP and checks type, but that's
-- advisory only; a direct API call could upload anything, including an
-- SVG (which can carry an embedded <script>, a stored-XSS vector when
-- later served from the public bucket). Raster images only, 10MB ceiling
-- (the compression pipeline targets far less; this is a backstop against
-- abuse, not a real-world photo limit).
update storage.buckets
set file_size_limit = 10485760, -- 10MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('hostel-images', 'room-images');

-- 3. MEDIUM: reviews_update_author_or_admin (Session 2) lets an author
-- update *any* column on their own review via a direct API call --
-- including reported (self-clearing a moderation flag report_review()
-- set) and is_resident (forging the "saved this hostel" signal the app
-- itself only ever sets honestly at insert time, see reviews.ts). A
-- trigger closes both gaps without touching the RLS policy itself or any
-- app code:
--   - is_resident can only change via an admin (the app never changes it
--     after insert at all -- see reviews.ts's own comment -- so this is a
--     pure tightening, no legitimate path is blocked).
--   - reported can still flip false -> true by anyone (that's exactly
--     what report_review() does, called by any authenticated reporter who
--     is never an admin) but can only flip true -> false (clearing a
--     report) by an admin -- dismissReportAdmin already runs as an
--     authenticated admin session, so it's unaffected.
create or replace function public.protect_review_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_resident is distinct from old.is_resident and not public.is_admin() then
    new.is_resident := old.is_resident;
  end if;

  if old.reported = true and new.reported = false and not public.is_admin() then
    new.reported := true;
  end if;

  return new;
end;
$$;

create trigger protect_review_flags
  before update on public.reviews
  for each row execute function public.protect_review_flags();

-- 4. LOW: nothing capped how many pending submissions one account could
-- create -- a hostile account could flood the review queue with hundreds
-- of junk listings. DB-enforced cap (not just app-level validation, which
-- a direct API call would skip): max 3 pending submissions per user at
-- once. Approved/rejected submissions don't count against the cap.
create or replace function public.limit_pending_submissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_count integer;
begin
  select count(*) into v_pending_count
  from public.submissions
  where submitted_by = new.submitted_by and status = 'pending';

  if v_pending_count >= 3 then
    raise exception 'You already have % pending submissions -- wait for a review before submitting more', v_pending_count;
  end if;

  return new;
end;
$$;

create trigger limit_pending_submissions
  before insert on public.submissions
  for each row execute function public.limit_pending_submissions();

-- 5. LOW: get_hostel_feed's p_limit was unbounded -- a negative value
-- already errors (Postgres rejects LIMIT < 0), but an absurdly large one
-- would just return the whole table in one call. Clamped to 50; every
-- real caller asks for 10.
create or replace function public.get_hostel_feed(
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
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.get_hostel_feed to anon, authenticated;
