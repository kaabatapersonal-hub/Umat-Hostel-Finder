-- Session: username-at-signup, "price varies" marketplace listings.
-- The share-to-invite feature (the third piece of this session's brief)
-- needs no schema change at all -- it's a pure client-side copy/message
-- change, see src/lib/share-message.ts.

-- =========================================================================
-- 1. handle_new_user() reads username from signup metadata
-- =========================================================================
-- AuthSheet now collects a username at signup time and passes it via
-- supabase.auth.signUp({ options: { data: { username } } }) -- same
-- raw_user_meta_data channel full_name/avatar_url already use below.
-- Defensive validation here (not just trusting the client) because this
-- trigger fires on auth.users insert itself: if the CHECK constraint on
-- profiles.username rejected a malformed value, the whole insert (and
-- therefore the whole signup) would fail, not just silently drop the
-- username. A bad/oversized value is treated as "no username supplied"
-- instead of blocking account creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_palette text[] := array['#E8A33D', '#3B82F6', '#10B981', '#8B5CF6', '#F43F5E', '#06B6D4', '#F59E0B', '#6366F1'];
  v_username text;
begin
  v_username := new.raw_user_meta_data ->> 'username';
  if v_username is not null and (char_length(v_username) > 30 or v_username !~ '^[a-zA-Z0-9_ ]+$') then
    v_username := null;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, avatar_color, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    v_palette[1 + floor(random() * array_length(v_palette, 1))::int],
    v_username
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- =========================================================================
-- 2. Marketplace "price varies" listings
-- =========================================================================
-- Sellers were marking flyer-style listings (several items/prices in one
-- photo) as Free (price=0) purely as a workaround -- there was no way to
-- say "see the photo for prices" without lying about the price. price
-- stays numeric not null (0 as a placeholder when this flag is set,
-- same as Free already does) -- price_varies is what actually
-- distinguishes the two states everywhere price is read.

alter table public.market_listings add column if not exists price_varies boolean not null default false;

-- get_market_feed grows price_varies as an output column -- drop+recreate,
-- not CREATE OR REPLACE (confirmed the hard way in the last session:
-- CREATE OR REPLACE does not actually replace a function whose parameter
-- or return-column list changed, it silently creates a second, ambiguous
-- overload instead). free_only now excludes price_varies listings (they
-- aren't actually free); an explicit min/max price filter excludes them
-- too, since there's no real number to compare against.
drop function if exists public.get_market_feed(
  text, text, text, boolean, numeric, numeric, text, timestamptz, numeric, uuid, integer, boolean, text
);

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
  is_unclaimed boolean,
  price_varies boolean,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    id, seller_id, title, description, price, category, condition,
    images, contact, is_service, is_leaving_sale, service_type, views_count,
    is_unclaimed, price_varies, created_at
  from public.market_listings
  where status = 'active'
    and (p_category is null or category = p_category)
    and (p_condition is null or condition = p_condition)
    and (not p_free_only or (price = 0 and not price_varies))
    and (p_price_min is null or (not price_varies and price >= p_price_min))
    and (p_price_max is null or (not price_varies and price <= p_price_max))
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
