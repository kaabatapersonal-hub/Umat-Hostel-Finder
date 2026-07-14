-- Session 19: Student Marketplace (Part 1 -- Core)
--
-- Moderation model deliberately mirrors buzz_posts, not submissions: live
-- immediately (public RLS insert), admin moderates after the fact via
-- delete/status change, no staging/review queue. A marketplace listing is
-- much higher-volume and lower-stakes than a hostel record -- requiring
-- admin pre-approval on every listing would kill the "under 60 seconds to
-- post" goal outright.
--
-- hostel_id and is_leaving_sale are nullable/unused this session on
-- purpose -- Session 20 wires them up ("items at this hostel",
-- "Leaving Campus Sale"). Adding the columns now means Session 20 doesn't
-- need its own migration just to grow the table.
--
-- Every statement below is written to be safely re-runnable (IF NOT
-- EXISTS / DROP-then-CREATE / ON CONFLICT) -- if a prior run of this same
-- file got partway through and stopped, re-running the whole thing from
-- the top will finish whatever's missing rather than erroring on whatever
-- already landed.

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) >= 3 and char_length(title) <= 120),
  description text check (description is null or char_length(description) <= 1000),
  price numeric not null check (price >= 0),
  category text not null check (
    category in (
      'hostel_essentials', 'academics', 'electronics', 'fashion',
      'kitchen', 'transport', 'gaming', 'services', 'other'
    )
  ),
  condition text check (condition in ('new', 'like_new', 'good', 'fair')),
  images jsonb not null default '[]',
  contact text not null,
  is_service boolean not null default false,
  status text not null default 'active' check (status in ('active', 'sold', 'removed')),
  is_leaving_sale boolean not null default false,
  hostel_id uuid references public.hostels (id) on delete set null,
  views_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_listings_category_idx on public.market_listings (category);
create index if not exists market_listings_status_idx on public.market_listings (status);
create index if not exists market_listings_created_at_idx on public.market_listings (created_at desc);
create index if not exists market_listings_seller_id_idx on public.market_listings (seller_id);
create index if not exists market_listings_price_idx on public.market_listings (price);
create index if not exists market_listings_hostel_id_idx on public.market_listings (hostel_id);
create index if not exists market_listings_status_created_at_idx on public.market_listings (status, created_at desc);
create index if not exists market_listings_status_category_created_at_idx on public.market_listings (status, category, created_at desc);

drop trigger if exists set_updated_at on public.market_listings;
create trigger set_updated_at
  before update on public.market_listings
  for each row execute function public.set_updated_at();

-- One trigger, same shape as protect_buzz_post_writes:
--  1. is_service is never client-settable -- always recomputed from
--     category, on both insert and update, so it can't be used to bypass
--     category-based display logic.
--  2. seller_id/views_count are pinned to their old values on update -- an
--     author editing their own listing must never be able to reassign
--     ownership or forge the RPC-maintained view count.
--  3. status can only move to 'removed' (the admin moderation hide) if
--     the caller is admin -- RLS's own `seller_id = auth.uid() or
--     is_admin()` would otherwise let a seller set it themselves. Sellers
--     can still freely toggle active/sold on their own listing (mark as
--     sold, or relist) -- only the moderation state is admin-gated.
create or replace function public.protect_market_listing_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.seller_id := old.seller_id;
    new.views_count := old.views_count;

    if new.status = 'removed' and old.status <> 'removed' and not public.is_admin() then
      new.status := old.status;
    end if;
  end if;

  new.is_service := (new.category = 'services');

  return new;
end;
$$;

-- "update of <every column except views_count>" -- not a plain "before
-- update". Postgres only fires an "UPDATE OF col_list" trigger when the
-- UPDATE statement's own SET clause names one of those columns; it never
-- looks at whether the value actually changed, and it isn't affected by
-- what any *other* trigger does. increment_listing_views' UPDATE only ever
-- SETs views_count -- if this trigger watched every column (including
-- views_count) the way it first shipped, its own `new.views_count :=
-- old.views_count` line would silently undo that RPC's increment every
-- time, since the trigger can't distinguish "the RPC incrementing it"
-- from "a client tampering with it" once it's already firing. Excluding
-- views_count from the watched list sidesteps that entirely: a pure
-- view-count-only update never fires this trigger at all, while any real
-- edit (title, price, ...) -- even one that also tries to smuggle in a
-- views_count change alongside it -- still fires it and still gets
-- views_count reset, exactly as intended.
drop trigger if exists protect_market_listing_writes on public.market_listings;
create trigger protect_market_listing_writes
  before insert or update of
    seller_id, title, description, price, category, condition, images,
    contact, is_service, status, is_leaving_sale, hostel_id
  on public.market_listings
  for each row execute function public.protect_market_listing_writes();

-- RLS
alter table public.market_listings enable row level security;

drop policy if exists "market_listings_select_all" on public.market_listings;
create policy "market_listings_select_all"
  on public.market_listings for select
  using (true);

-- Same content-creation abuse surface as reviews/submissions/buzz --
-- suspended accounts can't list either.
drop policy if exists "market_listings_insert_own" on public.market_listings;
create policy "market_listings_insert_own"
  on public.market_listings for insert
  with check (seller_id = auth.uid() and not public.is_suspended());

drop policy if exists "market_listings_update_seller_or_admin" on public.market_listings;
create policy "market_listings_update_seller_or_admin"
  on public.market_listings for update
  using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());

drop policy if exists "market_listings_delete_seller_or_admin" on public.market_listings;
create policy "market_listings_delete_seller_or_admin"
  on public.market_listings for delete
  using (seller_id = auth.uid() or public.is_admin());

-- Public, unauthenticated-callable -- a view is just a read, and gating it
-- behind auth would undercount every anonymous browse. Not rate-limited;
-- worst case is an inflated-but-harmless popularity number, not a
-- security issue, so this stays a simple atomic increment rather than
-- something that needs dedup/abuse-detection machinery.
create or replace function public.increment_listing_views(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.market_listings set views_count = views_count + 1 where id = p_listing_id;
end;
$$;

grant execute on function public.increment_listing_views(uuid) to anon, authenticated;

-- Feed RPC: three selectable sort modes (get_hostel_feed only ever needed
-- one), so the cursor carries both a created_at and a price value and the
-- SQL itself decides which one is live via p_sort -- the *other* column's
-- case-when branch is null for every row alike under a given p_sort, which
-- is a no-op in ORDER BY, not a bug (only ever one branch actually
-- discriminates rows at a time).
create or replace function public.get_market_feed(
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
  p_limit integer default 20
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
    images, contact, is_service, is_leaving_sale, views_count, created_at
  from public.market_listings
  where status = 'active'
    and (p_category is null or category = p_category)
    and (p_condition is null or condition = p_condition)
    and (not p_free_only or price = 0)
    and (p_price_min is null or price >= p_price_min)
    and (p_price_max is null or price <= p_price_max)
    and (p_search is null or p_search = '' or title ilike '%' || p_search || '%' or description ilike '%' || p_search || '%')
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

-- The listing detail page needs the seller's display name and join date --
-- Session 15 locked public.profiles' SELECT to `id = auth.uid() or
-- is_admin()`, so a stranger viewing someone else's listing can't read
-- that seller's profiles row directly (reviews/buzz hit this same wall
-- and solved it by denormalizing a name column onto every row; a listing
-- only needs this once, on-demand, at detail-view time, so a small public
-- RPC returning just the two safe fields -- never email/role -- is a
-- better fit here than yet another denormalized column that could drift
-- from the real profile).
create or replace function public.get_seller_public_profile(p_seller_id uuid)
returns table (full_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select full_name, created_at from public.profiles where id = p_seller_id;
$$;

grant execute on function public.get_seller_public_profile(uuid) to anon, authenticated;

-- Storage bucket, hardened from the start (Session 15 added this after the
-- fact for the other two buckets; no reason to ship this one soft).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('market-images', 'market-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "market_images_public_read" on storage.objects;
create policy "market_images_public_read"
  on storage.objects for select
  using (bucket_id = 'market-images');

drop policy if exists "market_images_authenticated_insert" on storage.objects;
create policy "market_images_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'market-images' and auth.role() = 'authenticated');

drop policy if exists "market_images_owner_update" on storage.objects;
create policy "market_images_owner_update"
  on storage.objects for update
  using (bucket_id = 'market-images' and owner = auth.uid())
  with check (bucket_id = 'market-images' and owner = auth.uid());

drop policy if exists "market_images_owner_delete" on storage.objects;
create policy "market_images_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'market-images' and owner = auth.uid());

-- Feature-flag gate. A single config table (not a one-off boolean column
-- somewhere) so any later feature can reuse the same on/off switch without
-- another migration. Publicly readable (the client needs to know whether
-- to show the teaser or the real feed) but only admin-writable -- flipping
-- it today is a direct SQL UPDATE (see SESSION_19_APPLY.md), same as every
-- other migration-adjacent manual step in this project; the admin-only
-- UPDATE/INSERT policies just leave the door open for a future admin-panel
-- toggle without a schema change.
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.app_config;
create trigger set_updated_at
  before update on public.app_config
  for each row execute function public.set_updated_at();

alter table public.app_config enable row level security;

drop policy if exists "app_config_select_all" on public.app_config;
create policy "app_config_select_all"
  on public.app_config for select
  using (true);

drop policy if exists "app_config_insert_admin" on public.app_config;
create policy "app_config_insert_admin"
  on public.app_config for insert
  with check (public.is_admin());

drop policy if exists "app_config_update_admin" on public.app_config;
create policy "app_config_update_admin"
  on public.app_config for update
  using (public.is_admin())
  with check (public.is_admin());

insert into public.app_config (key, value) values ('marketplace_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- Running DDL through the SQL editor (rather than Supabase's own migration
-- pipeline, which sends this automatically) doesn't always make PostgREST
-- notice new functions/tables right away -- get_seller_public_profile was
-- invisible to PostgREST ("not found in schema cache") for several minutes
-- after this file first ran. This forces an immediate reload instead of
-- waiting on PostgREST's own periodic refresh.
notify pgrst, 'reload schema';
