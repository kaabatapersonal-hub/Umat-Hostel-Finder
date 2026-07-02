-- get_hostel_feed: the single query behind the Discovery Feed. Combines
-- search, the 5 filter chips, and keyset ("cursor") pagination with a
-- two-tier sort (actively-featured first, then newest) into one server-side
-- round trip — the app never fetches everything and filters client-side.
--
-- Sort key is the row triple (is_actively_featured, created_at, id), all
-- DESC. Postgres row-value comparison (`(a,b,c) < (x,y,z)`) makes correct
-- keyset pagination over that composite key straightforward: "give me rows
-- that sort after the cursor row" is just `row < cursor_row` when the order
-- is DESC. This is the standard multi-column keyset pattern, done in SQL
-- instead of hand-built PostgREST filter strings.
--
-- Filter chip conventions (decided here since the schema doesn't dictate
-- them): "Near Campus" and "En-suite" are tags — seed/admin tooling should
-- add the literal tags 'near_campus' and 'en_suite' to a hostel's `tags`
-- array (or `facilities` for en_suite) to make it match those chips.
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
  price numeric,
  location text,
  distance_text text,
  images text[],
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
    h.price,
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
    and (not p_under_budget or h.price < 2000)
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
