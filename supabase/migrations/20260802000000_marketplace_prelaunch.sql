-- Marketplace pre-launch & vendor onboarding.
--
-- The marketplace already exists in full (market_listings, categories,
-- images, Leaving Campus Sale, services) -- it's just currently gated
-- behind app_config.marketplace_enabled = false, which today shows every
-- visitor a bare "Coming Soon" screen and blocks nothing else (listing
-- submission itself was never actually gated by the flag). This session
-- adds a real pre-launch flow: students can list now, everything they
-- submit is held as 'pending_launch' (hidden from the public, visible
-- only to its own seller and admins) until the flag flips on, at which
-- point every pending listing becomes 'active' automatically -- plus an
-- admin-assisted creation path for vendors who won't sign up themselves,
-- and a claim system so those vendors can take ownership later.

-- =========================================================================
-- 1. market_listings: new status + vendor/unclaimed columns
-- =========================================================================

alter table public.market_listings drop constraint if exists market_listings_status_check;
alter table public.market_listings add constraint market_listings_status_check
  check (status in ('active', 'sold', 'removed', 'pending_launch'));

-- Set by admin-assisted creation (Part 5) -- the listing is attributed to
-- the admin's own account (seller_id) until claimed, with these two
-- columns carrying the real vendor's info for display/contact.
alter table public.market_listings add column if not exists vendor_name text;
alter table public.market_listings add column if not exists vendor_whatsapp text;
alter table public.market_listings add column if not exists is_unclaimed boolean not null default false;

-- Public reads now exclude pending_launch rows for everyone except the
-- listing's own seller and admins -- "hidden from the public until
-- launch" needs to be true at the RLS layer, not just true because the
-- feed RPC happens to filter on status. A pending listing's full detail
-- (photos, price, contact number) is exactly the kind of thing that
-- shouldn't be one direct REST call away from anyone who thinks to try,
-- even before an official launch announcement.
drop policy if exists "market_listings_select_all" on public.market_listings;
create policy "market_listings_select_all"
  on public.market_listings for select
  using (status <> 'pending_launch' or seller_id = auth.uid() or public.is_admin());

-- A safe, narrow exception to the above: the *count* of pending listings
-- is meant to be public (Part 9's "X products already submitted" stat),
-- even though individual pending listings are not. Same posture as
-- get_active_users_count/get_unread_notifications_count -- expose only
-- the aggregate via a dedicated RPC, never the underlying rows.
create or replace function public.get_pending_launch_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.market_listings where status = 'pending_launch';
$$;

grant execute on function public.get_pending_launch_count() to anon, authenticated;

-- =========================================================================
-- 2. Auto pending-launch on insert, auto-launch on toggle
-- =========================================================================

-- Same shape as the Session 22 version (is_leaving_sale inheritance +
-- service_type nulling below are carried over unchanged from it -- an
-- earlier draft of this function accidentally dropped both while adding
-- the new logic; restored here, self-caught via the live audit), extended:
--  4. On INSERT, if the marketplace isn't live yet, status is forced to
--     'pending_launch' regardless of whatever the client sent -- the
--     same "never trust the client for state that depends on global
--     config" posture is_service already uses for category.
--  5. seller_id can now legitimately change -- but only through
--     resolve_listing_claim's own transfer (Part 3), signaled by a
--     transaction-local flag, never through a direct client update. This
--     is the one case where the existing "seller_id is pinned on update"
--     rule needs an escape hatch; a flag, not a permission check, so
--     ownership transfer only ever happens through that one audited RPC,
--     not from any admin editing a listing directly.
--  6. A direct attempt to move a listing from 'pending_launch' to
--     'active' outside of the bulk auto-launch (Part below) is reverted
--     unless the caller has moderate_market -- same permission the
--     'removed' guard below already required, not a blanket is_admin()
--     (which would let a sub-admin scoped to something unrelated, e.g.
--     moderate_reviews, jump every listing in the queue).
create or replace function public.protect_market_listing_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marketplace_enabled boolean;
begin
  if tg_op = 'INSERT' then
    new.is_leaving_sale := coalesce((select p.is_leaving_sale from public.profiles p where p.id = new.seller_id), false);

    select coalesce(value = 'true'::jsonb, false) into v_marketplace_enabled
    from public.app_config where key = 'marketplace_enabled';

    if not coalesce(v_marketplace_enabled, false) then
      new.status := 'pending_launch';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if coalesce(current_setting('app.claim_transfer', true), '') <> 'true' then
      new.seller_id := old.seller_id;
    end if;
    new.views_count := old.views_count;

    if new.status = 'removed' and old.status <> 'removed' and not public.has_permission('moderate_market') then
      new.status := old.status;
    end if;

    if new.status = 'active' and old.status = 'pending_launch'
       and coalesce(current_setting('app.marketplace_launching', true), '') <> 'true'
       and not public.has_permission('moderate_market') then
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

-- The watched-column list needs is_unclaimed added (vendor_name/
-- vendor_whatsapp don't need to be watched -- they're never protected,
-- freely editable like title/description) so a claim-transfer update
-- (which touches seller_id + is_unclaimed together) actually fires this
-- trigger; seller_id was already watched.
drop trigger if exists protect_market_listing_writes on public.market_listings;
create trigger protect_market_listing_writes
  before insert or update of
    seller_id, title, description, price, category, condition, images,
    contact, is_service, status, is_leaving_sale, hostel_id, is_unclaimed
  on public.market_listings
  for each row execute function public.protect_market_listing_writes();

-- toggle_marketplace: bulk-launch every pending listing the instant the
-- flag flips on. The session-local flag is what lets this bulk UPDATE
-- pass the "no direct pending_launch -> active" guard above without
-- weakening that guard for anyone else.
create or replace function public.toggle_marketplace()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_value jsonb;
begin
  if not public.has_permission('moderate_market') then
    raise exception 'Not authorized';
  end if;

  update public.app_config
  set value = case when value = 'true'::jsonb then 'false'::jsonb else 'true'::jsonb end
  where key = 'marketplace_enabled'
  returning value into v_new_value;

  if not found then
    raise exception 'marketplace_enabled config row not found';
  end if;

  if v_new_value = 'true'::jsonb then
    perform set_config('app.marketplace_launching', 'true', true);
    update public.market_listings set status = 'active' where status = 'pending_launch';
  end if;

  return v_new_value = 'true'::jsonb;
end;
$$;

-- =========================================================================
-- 3. Listing ownership claims
-- =========================================================================

create table if not exists public.market_listing_claims (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_listing_claims_listing_id_idx on public.market_listing_claims (listing_id);
create index if not exists market_listing_claims_claimant_id_idx on public.market_listing_claims (claimant_id);

drop trigger if exists set_updated_at on public.market_listing_claims;
create trigger set_updated_at
  before update on public.market_listing_claims
  for each row execute function public.set_updated_at();

alter table public.market_listing_claims enable row level security;

-- Own-or-moderator, same shape as buzz_reports_select_own_or_moderator --
-- a claimant needs to see their own request's status; an admin needs to
-- review the queue.
drop policy if exists "market_listing_claims_select_own_or_moderator" on public.market_listing_claims;
create policy "market_listing_claims_select_own_or_moderator"
  on public.market_listing_claims for select
  using (claimant_id = auth.uid() or public.has_permission('moderate_market'));

-- The "only unclaimed listings can be claimed" business rule needs to read
-- market_listings from inside a WITH CHECK -- but that table's own SELECT
-- policy hides pending_launch rows from anyone who isn't its seller or an
-- admin (Part 1 above), which includes every legitimate claimant on an
-- admin-created, still-pending-launch listing. A raw `exists` subquery
-- here would run as the claimant and get silently zero rows back from
-- RLS, rejecting every real claim before launch. A narrow security
-- definer helper -- same posture as is_admin()/has_permission() already
-- used throughout this policy -- checks is_unclaimed without going
-- through market_listings' own row-visibility rules at all, since this
-- is an ownership check, not a visibility grant.
create or replace function public.is_listing_unclaimed(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_unclaimed from public.market_listings where id = p_listing_id), false);
$$;

drop policy if exists "market_listing_claims_insert_own" on public.market_listing_claims;
create policy "market_listing_claims_insert_own"
  on public.market_listing_claims for insert
  with check (
    claimant_id = auth.uid()
    and not public.is_suspended()
    and public.is_listing_unclaimed(listing_id)
  );

-- No update/delete policy at all -- resolve_listing_claim (below) is the
-- only path that ever changes a claim's status, running as security
-- definer, which bypasses RLS entirely as the function owner.

-- One pending claim per (listing, claimant) at a time -- resubmitting
-- while already pending is a no-op the UI should just treat as "already
-- requested," not a new row.
create unique index if not exists market_listing_claims_one_pending_per_claimant
  on public.market_listing_claims (listing_id, claimant_id)
  where status = 'pending';

-- Admin-only: approve transfers ownership atomically (seller_id +
-- is_unclaimed together, via the claim_transfer flag) and rejects every
-- other still-pending claim on the same listing, since only one person
-- can end up owning it. Reject just marks this one claim rejected.
create or replace function public.resolve_listing_claim(p_claim_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_claimant_id uuid;
begin
  if not public.has_permission('moderate_market') then
    raise exception 'Not authorized';
  end if;

  if p_action not in ('approve', 'reject') then
    raise exception 'Unknown action: %', p_action;
  end if;

  select listing_id, claimant_id into v_listing_id, v_claimant_id
  from public.market_listing_claims
  where id = p_claim_id and status = 'pending';

  if v_listing_id is null then
    raise exception 'Claim not found or already resolved';
  end if;

  if p_action = 'approve' then
    perform set_config('app.claim_transfer', 'true', true);
    update public.market_listings
    set seller_id = v_claimant_id, is_unclaimed = false
    where id = v_listing_id;

    update public.market_listing_claims
    set status = 'approved', reviewed_by = auth.uid()
    where id = p_claim_id;

    -- Any other still-pending claim on the same listing is now moot.
    update public.market_listing_claims
    set status = 'rejected', reviewed_by = auth.uid()
    where listing_id = v_listing_id and status = 'pending' and id <> p_claim_id;
  else
    update public.market_listing_claims
    set status = 'rejected', reviewed_by = auth.uid()
    where id = p_claim_id;
  end if;
end;
$$;

grant execute on function public.resolve_listing_claim(uuid, text) to authenticated;

-- =========================================================================
-- 4. get_market_feed must also return is_unclaimed
-- =========================================================================
-- An admin-assisted listing created *after* launch is 'active' from the
-- moment it's created (see protect_market_listing_writes' INSERT branch --
-- it only forces pending_launch while the marketplace is off), so an
-- unclaimed listing can absolutely show up in the public feed, not just
-- on the detail page. Growing a table function's output columns needs
-- drop + recreate, not CREATE OR REPLACE (same as get_hot_buzz_posts and
-- get_hostel_feed before it).
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
    is_unclaimed, created_at
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

-- =========================================================================
-- 5. set_leaving_campus_mode must also cover pending_launch listings
-- =========================================================================
-- Its bulk is_leaving_sale update predates pending_launch entirely and
-- only ever matched status = 'active'. A student who lists something
-- while pre-launch (their listing sitting as 'pending_launch') and then
-- enables Leaving Campus Sale mode would have that bulk update silently
-- skip it -- and since it stays pending_launch until the bulk auto-launch
-- promotes it later, it would go live still missing the flag. New
-- pending_launch inserts already inherit is_leaving_sale correctly (Part 2
-- above runs on every INSERT regardless of status), so this only affects
-- the retroactive bulk-update path, but the fix is the same one line either
-- way -- include pending_launch alongside active.
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
    where seller_id = auth.uid() and status in ('active', 'pending_launch');
end;
$$;

notify pgrst, 'reload schema';
