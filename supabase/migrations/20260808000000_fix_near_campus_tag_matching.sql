-- Real bug found during QA: the "Near Campus" filter chip always returned
-- zero results in production. h.tags is freeform text a hostel owner types
-- into a ChipInput (submit-hostel-form.tsx's placeholder even shows
-- "e.g. near_campus, quiet" as an example, but no real user actually types
-- an underscored token) -- the live data has tags like "Near campus" and
-- "Quiet", never the literal lowercase "near_campus" the filter required
-- via `h.tags @> array['near_campus']`. Same latent issue on the en_suite
-- filter's tags fallback (its primary match via the *structured*
-- facilities[] picker was already fine, so that one wasn't user-visible).
-- Fix: match tags case/whitespace/underscore-insensitively instead of
-- requiring an exact token, so existing freeform data just works. Same
-- signature and return columns as the current function -- CREATE OR
-- REPLACE is correct here, no DROP needed.

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
  p_limit int default 10,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_room_type text default null
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
    and (
      not p_near_campus
      or exists (
        select 1 from unnest(h.tags) as t
        where lower(regexp_replace(trim(t), '[\s_]+', ' ', 'g')) = 'near campus'
      )
    )
    and (not p_under_budget or h.price_min < 2000)
    and (not p_available_now or h.availability = 'available')
    and (not p_featured_only or (h.featured and (h.featured_until is null or h.featured_until > now())))
    and (
      not p_en_suite
      or h.facilities @> array['en_suite']
      or exists (
        select 1 from unnest(h.tags) as t
        where lower(regexp_replace(trim(t), '[\s_]+', ' ', 'g')) in ('en suite', 'ensuite')
      )
    )
    and (p_price_min is null or h.price_max >= p_price_min)
    and (p_price_max is null or h.price_min <= p_price_max)
    and (
      p_room_type is null
      or exists (select 1 from jsonb_array_elements(h.room_types) e where e ->> 'type' = p_room_type)
    )
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
