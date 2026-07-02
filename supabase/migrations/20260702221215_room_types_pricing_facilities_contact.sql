-- Session 4.5: room types become a structured list (each with its own
-- price + photos, using UMaT's own occupancy terms), price_min/price_max
-- are maintained columns so the feed can filter/sort without unpacking
-- jsonb per row, and hostels gain an optional call_number alongside the
-- required WhatsApp contact.
--
-- Order matters here: add the new columns, backfill them from the old
-- shape, redefine get_hostel_feed() to stop referencing the old columns,
-- THEN drop them — Postgres won't let you drop a column a SQL function
-- still depends on.

-- 1. New columns.
alter table public.hostels add column room_types jsonb not null default '[]';
alter table public.hostels add column price_min numeric;
alter table public.hostels add column price_max numeric;
alter table public.hostels add column call_number text;

-- 2. Trigger that keeps price_min/price_max in sync with room_types,
-- exactly like the review-rating trigger keeps hostels.rating_avg in sync
-- with reviews — the feed reads two cheap columns, never unpacks jsonb.
-- An empty room_types array yields NULL/NULL (no price data), not 0.
create or replace function public.maintain_hostel_price_range()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min numeric;
  v_max numeric;
begin
  select min((elem ->> 'price')::numeric), max((elem ->> 'price')::numeric)
  into v_min, v_max
  from jsonb_array_elements(new.room_types) as elem;

  new.price_min := v_min;
  new.price_max := v_max;
  return new;
end;
$$;

create trigger maintain_hostel_price_range
  before insert or update of room_types on public.hostels
  for each row execute function public.maintain_hostel_price_range();

-- 3. Backfill existing test data: old single price/room_type/room_images
-- become a one-entry room_types array. Old occupancy terms map onto UMaT's
-- terms 1:1 by headcount (single=1, double=2, triple=3, quad=4); anything
-- unset defaults to 2_in_room since every test row has a real price but
-- some were never given a room_type.
update public.hostels
set room_types = jsonb_build_array(
  jsonb_build_object(
    'type', case room_type
      when 'single' then '1_in_room'
      when 'double' then '2_in_room'
      when 'triple' then '3_in_room'
      when 'quad' then '4_in_room'
      else '2_in_room'
    end,
    'price', price,
    'images', coalesce(room_images -> room_type, '[]'::jsonb)
  )
);

-- 4. Redefine get_hostel_feed(): price -> price_min/price_max, and
-- "under budget" now means "has at least one room under GHS 2,000"
-- (price_min < 2000) rather than a single price. This removes the
-- function's dependency on hostels.price so it can be dropped below.
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

-- 5. Drop the old columns now that nothing depends on them. This also
-- drops hostels_price_idx (indexed only price) and the room_type CHECK
-- constraint automatically.
alter table public.hostels drop column price;
alter table public.hostels drop column room_type;
alter table public.hostels drop column room_images;

-- 6. Index price_min — this is what "Under GHS X" filters on.
create index hostels_price_min_idx on public.hostels (price_min);
