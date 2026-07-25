-- The details page's hero gallery already merges room_types[].images in as
-- a fallback when the general images array is empty (client-side, no
-- schema change needed -- see mergeGalleryImages in src/lib/room-types.ts).
-- The feed cards need the same fallback, but the feed goes through
-- get_hostel_feed, an RPC -- the client only ever sees the columns the
-- function itself returns, and room_types was never one of them. Growing a
-- table function's *output* columns needs DROP FUNCTION + recreate, not
-- CREATE OR REPLACE (same thing Session 20 hit with get_seller_public_profile
-- and get_market_feed) -- CREATE OR REPLACE only allows adding new
-- *parameters* with defaults, not new result columns.
drop function if exists public.get_hostel_feed(
  text, boolean, boolean, boolean, boolean, boolean, boolean, timestamptz, uuid, int
);

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
  room_types jsonb,
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
    h.room_types,
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

notify pgrst, 'reload schema';
