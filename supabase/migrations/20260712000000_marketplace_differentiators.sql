-- Session 20: Marketplace Differentiators
--
-- Activates the three Session 19 placeholder columns (is_leaving_sale,
-- hostel_id, is_service) plus one brand-new column (service_type).
--
-- Leaving Campus Sale is modeled as a *profile-level* switch
-- (profiles.is_leaving_sale/leaving_date), not just a per-listing flag --
-- a listing-only flag can't answer "is this seller currently in leaving
-- mode?" once listings get created/sold/deleted over time, and the brief
-- explicitly wants new listings to auto-inherit the mode. The profile flag
-- is the single source of truth; protect_market_listing_writes stamps it
-- onto every new listing at insert time, and set_leaving_campus_mode bulk-
-- syncs it onto existing active listings when the student flips the
-- switch. (A listing's own is_leaving_sale can still drift from the
-- profile flag after the fact -- e.g. the student lists something new
-- after turning the mode off, then turns it back on without an
-- accompanying listing edit -- but there's no UI for a *per-listing*
-- override, so this is a non-issue in practice, not a bug worth a
-- consistency trigger.)
--
-- Every statement is safely re-runnable, same as the Session 19 migration.

alter table public.profiles add column if not exists is_leaving_sale boolean not null default false;
alter table public.profiles add column if not exists leaving_date date;

alter table public.market_listings add column if not exists service_type text
  check (service_type in ('tutoring', 'design', 'programming', 'laundry', 'haircut_barber', 'photography', 'other'));

create index if not exists market_listings_is_leaving_sale_idx on public.market_listings (is_leaving_sale) where is_leaving_sale;
create index if not exists market_listings_service_type_idx on public.market_listings (service_type);

-- Redefine the write-protection trigger function: same shape as Session 19,
-- plus (a) INSERT now stamps is_leaving_sale from the seller's *current*
-- profile flag -- never client-settable, so a listing can't be forged into
-- "leaving sale" status independent of the seller's real switch -- and
-- (b) service_type is force-nulled whenever category isn't 'services', the
-- same tamper-proofing pattern is_service already gets.
create or replace function public.protect_market_listing_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.is_leaving_sale := coalesce((select p.is_leaving_sale from public.profiles p where p.id = new.seller_id), false);
  end if;

  if tg_op = 'UPDATE' then
    new.seller_id := old.seller_id;
    new.views_count := old.views_count;

    if new.status = 'removed' and old.status <> 'removed' and not public.is_admin() then
      new.status := old.status;
    end if;
  end if;

  new.is_service := (new.category = 'services');
  if new.category <> 'services' then
    new.service_type := null;
  end if;

  return new;
end;
$$;

-- service_type added to the watched-column list (still excluding
-- views_count -- see Session 19's comment on why that exclusion matters).
drop trigger if exists protect_market_listing_writes on public.market_listings;
create trigger protect_market_listing_writes
  before insert or update of
    seller_id, title, description, price, category, condition, images,
    contact, is_service, status, is_leaving_sale, hostel_id, service_type
  on public.market_listings
  for each row execute function public.protect_market_listing_writes();

-- Bulk-activates/deactivates Leaving Campus mode: flips the profile switch
-- and syncs is_leaving_sale onto every one of the caller's *active*
-- listings in one round trip. security invoker (not definer) on purpose --
-- both underlying UPDATEs only ever touch rows the caller's own RLS
-- policies (profiles_update_own, market_listings_update_seller_or_admin)
-- already let them touch, so there's no privilege to escalate here; this
-- is a convenience/atomicity wrapper, not a security boundary.
create or replace function public.set_leaving_campus_mode(p_enabled boolean, p_leaving_date date default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  update public.profiles
    set is_leaving_sale = p_enabled, leaving_date = p_leaving_date
    where id = auth.uid();

  update public.market_listings
    set is_leaving_sale = p_enabled
    where seller_id = auth.uid() and status = 'active';
end;
$$;

grant execute on function public.set_leaving_campus_mode(boolean, date) to authenticated;

-- get_seller_public_profile grows two columns for the seller sale page
-- (badge + leaving date) -- CREATE OR REPLACE can't change a table-
-- returning function's output columns, so this is drop-then-create rather
-- than the plain replace Session 19 used for the trigger function.
drop function if exists public.get_seller_public_profile(uuid);
create function public.get_seller_public_profile(p_seller_id uuid)
returns table (full_name text, created_at timestamptz, is_leaving_sale boolean, leaving_date date)
language sql
stable
security definer
set search_path = public
as $$
  select full_name, created_at, is_leaving_sale, leaving_date from public.profiles where id = p_seller_id;
$$;

grant execute on function public.get_seller_public_profile(uuid) to anon, authenticated;

-- get_market_feed grows a "Leaving Sales" filter, a service_type filter
-- (for the Services category's own sub-tag chips), and returns
-- service_type on every row -- also drop-then-create for the same reason.
drop function if exists public.get_market_feed(text, text, text, boolean, numeric, numeric, text, timestamptz, numeric, uuid, integer);
create function public.get_market_feed(
  p_search text default null,
  p_category text default null,
  p_condition text default null,
  p_free_only boolean default false,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_sort text default 'newest',
  p_cursor_created_at timestamptz default null,
  p_cursor_price numeric default null,
  p_cursor_id uuid default null,
  p_limit integer default 20,
  p_leaving_sale_only boolean default false,
  p_service_type text default null
)
returns table (
  id uuid,
  seller_id uuid,
  title text,
  description text,
  price numeric,
  category text,
  condition text,
  images jsonb,
  contact text,
  is_service boolean,
  is_leaving_sale boolean,
  service_type text,
  views_count integer,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    id, seller_id, title, description, price, category, condition,
    images, contact, is_service, is_leaving_sale, service_type, views_count, created_at
  from public.market_listings
  where status = 'active'
    and (p_category is null or category = p_category)
    and (p_condition is null or condition = p_condition)
    and (not p_free_only or price = 0)
    and (p_price_min is null or price >= p_price_min)
    and (p_price_max is null or price <= p_price_max)
    and (p_search is null or p_search = '' or title ilike '%' || p_search || '%' or description ilike '%' || p_search || '%')
    and (not p_leaving_sale_only or is_leaving_sale = true)
    and (p_service_type is null or service_type = p_service_type)
    and (
      (p_sort = 'price_asc' and (p_cursor_price is null or (price, id) > (p_cursor_price, p_cursor_id)))
      or (p_sort = 'price_desc' and (p_cursor_price is null or (price, id) < (p_cursor_price, p_cursor_id)))
      or (
        p_sort is distinct from 'price_asc' and p_sort is distinct from 'price_desc'
        and (p_cursor_created_at is null or (created_at, id) < (p_cursor_created_at, p_cursor_id))
      )
    )
  order by
    case when p_sort = 'price_asc' then price end asc nulls last,
    case when p_sort = 'price_desc' then price end desc nulls last,
    case when p_sort is distinct from 'price_asc' and p_sort is distinct from 'price_desc' then created_at end desc nulls last,
    id
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.get_market_feed to anon, authenticated;

notify pgrst, 'reload schema';
