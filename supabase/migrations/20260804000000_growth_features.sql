-- Growth features batch: marketplace saves, hostel price/room-type filters,
-- milestone badges, seller reviews, push notification infra, and admin
-- broadcast. Six independent pieces bundled into one migration per this
-- project's "single migration file per session" convention; each section
-- is self-contained and could be reverted independently if needed.

-- =========================================================================
-- 1. saved_market_listings -- mirrors saved_hostels exactly
-- =========================================================================

create table if not exists public.saved_market_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.market_listings (id) on delete cascade,
  listing_title text,
  listing_price numeric,
  listing_image_url text,
  listing_image_blur text,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create index if not exists saved_market_listings_listing_id_idx on public.saved_market_listings (listing_id);

alter table public.saved_market_listings enable row level security;

drop policy if exists "saved_market_listings_all_own" on public.saved_market_listings;
create policy "saved_market_listings_all_own"
  on public.saved_market_listings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "saved_market_listings_select_admin" on public.saved_market_listings;
create policy "saved_market_listings_select_admin"
  on public.saved_market_listings for select
  using (public.is_admin());

-- =========================================================================
-- 2. Hostel price range + room-type filters
-- =========================================================================
-- price_min/price_max are plain indexed columns on hostels (maintained by
-- the existing maintain_hostel_price_range trigger), so the range filter
-- is a simple WHERE clause; room_type has to inspect the room_types jsonb
-- array since there's no separate table.
--
-- This needs an explicit DROP + CREATE, not CREATE OR REPLACE -- adding
-- trailing parameters (even with defaults) changes the function's full
-- type signature, which Postgres treats as a distinct overload rather
-- than a true replace (confirmed live: CREATE OR REPLACE here left both
-- the old 10-arg and a new 13-arg get_hostel_feed coexisting, and the
-- very next plain `grant ... on function get_hostel_feed` failed with
-- "function name is not unique" since it could no longer tell which one
-- to grant to). Same drop+recreate discipline this project already uses
-- whenever a table function's *output columns* grow -- turns out it's
-- required for added *parameters* too, not just outputs. Both possible
-- old signatures are dropped so this is safe to re-run regardless of
-- which state a previous partial run left the database in.
drop function if exists public.get_hostel_feed(
  text, boolean, boolean, boolean, boolean, boolean, boolean, timestamptz, uuid, int
);
drop function if exists public.get_hostel_feed(
  text, boolean, boolean, boolean, boolean, boolean, boolean, timestamptz, uuid, int, numeric, numeric, text
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
    and (not p_near_campus or h.tags @> array['near_campus'])
    and (not p_under_budget or h.price_min < 2000)
    and (not p_available_now or h.availability = 'available')
    and (not p_featured_only or (h.featured and (h.featured_until is null or h.featured_until > now())))
    and (not p_en_suite or h.facilities @> array['en_suite'] or h.tags @> array['en_suite'])
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

-- =========================================================================
-- 3. Milestone badges -- one aggregate RPC, no new tables. Badges
-- themselves are computed client-side from these counts against threshold
-- constants (src/lib/badges.ts), recomputed on every view.
-- =========================================================================

create or replace function public.get_profile_stats(p_user_id uuid)
returns table (review_count integer, listing_count integer, buzz_post_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*)::integer from public.reviews where author_id = p_user_id),
    (select count(*)::integer from public.market_listings where seller_id = p_user_id and status = 'active'),
    (select count(*)::integer from public.buzz_posts where author_id = p_user_id);
$$;

grant execute on function public.get_profile_stats(uuid) to anon, authenticated;

-- =========================================================================
-- 4. Marketplace seller reviews -- mirrors reviews closely, but
-- deliberately has no "verified buyer" badge equivalent to reviews'
-- honest is_resident flag: WhatsApp handoff means the app never actually
-- sees whether a sale happened, so there's no real signal to report.
-- Rating is cached on profiles (a seller is just a profile, no separate
-- seller row exists) the same way hostels cache rating_avg/rating_count.
-- =========================================================================

alter table public.profiles add column if not exists seller_rating_avg numeric not null default 0;
alter table public.profiles add column if not exists seller_rating_count integer not null default 0;

create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) >= 15),
  reviewer_name text,
  reported boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, author_id),
  check (author_id <> seller_id)
);

create index if not exists seller_reviews_author_id_idx on public.seller_reviews (author_id);

drop trigger if exists set_updated_at on public.seller_reviews;
create trigger set_updated_at
  before update on public.seller_reviews
  for each row execute function public.set_updated_at();

create or replace function public.default_seller_reviewer_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reviewer_name is null then
    select full_name into new.reviewer_name from public.profiles where id = new.author_id;
  end if;
  return new;
end;
$$;

drop trigger if exists default_seller_reviewer_name on public.seller_reviews;
create trigger default_seller_reviewer_name
  before insert on public.seller_reviews
  for each row execute function public.default_seller_reviewer_name();

create or replace function public.recalculate_seller_rating(p_seller_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set seller_rating_avg = coalesce(r.avg_rating, 0),
      seller_rating_count = coalesce(r.review_count, 0)
  from (
    select round(avg(rating)::numeric, 2) as avg_rating, count(*) as review_count
    from public.seller_reviews
    where seller_id = p_seller_id
  ) r
  where p.id = p_seller_id;
end;
$$;

create or replace function public.handle_seller_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_seller_rating(old.seller_id);
    return old;
  end if;

  perform public.recalculate_seller_rating(new.seller_id);

  if tg_op = 'UPDATE' and old.seller_id is distinct from new.seller_id then
    perform public.recalculate_seller_rating(old.seller_id);
  end if;

  return new;
end;
$$;

drop trigger if exists seller_reviews_update_rating on public.seller_reviews;
create trigger seller_reviews_update_rating
  after insert or update or delete on public.seller_reviews
  for each row execute function public.handle_seller_review_change();

alter table public.seller_reviews enable row level security;

drop policy if exists "seller_reviews_select_all" on public.seller_reviews;
create policy "seller_reviews_select_all"
  on public.seller_reviews for select
  using (true);

drop policy if exists "seller_reviews_insert_own" on public.seller_reviews;
create policy "seller_reviews_insert_own"
  on public.seller_reviews for insert
  with check (author_id = auth.uid() and not public.is_suspended());

drop policy if exists "seller_reviews_update_author_or_admin" on public.seller_reviews;
create policy "seller_reviews_update_author_or_admin"
  on public.seller_reviews for update
  using (author_id = auth.uid() or public.has_permission('moderate_market'))
  with check (author_id = auth.uid() or public.has_permission('moderate_market'));

drop policy if exists "seller_reviews_delete_author_or_admin" on public.seller_reviews;
create policy "seller_reviews_delete_author_or_admin"
  on public.seller_reviews for delete
  using (author_id = auth.uid() or public.has_permission('moderate_market'));

create or replace function public.report_seller_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required to report a review';
  end if;

  update public.seller_reviews
  set reported = true
  where id = p_review_id;
end;
$$;

grant execute on function public.report_seller_review(uuid) to authenticated;

-- get_seller_public_profile grows seller_rating_avg/count -- drop+recreate,
-- same reasoning as every other output-column growth in this project.
drop function if exists public.get_seller_public_profile(uuid);
create function public.get_seller_public_profile(p_seller_id uuid)
returns table (
  full_name text,
  created_at timestamptz,
  is_leaving_sale boolean,
  leaving_date date,
  is_verified boolean,
  verification_label text,
  seller_rating_avg numeric,
  seller_rating_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select full_name, created_at, is_leaving_sale, leaving_date, is_verified, verification_label,
         seller_rating_avg, seller_rating_count
  from public.profiles
  where id = p_seller_id;
$$;

grant execute on function public.get_seller_public_profile(uuid) to anon, authenticated;

-- =========================================================================
-- 5. Push notification subscriptions
-- =========================================================================
-- Dispatch (actually sending a push when a notifications row is inserted)
-- is server-side infra outside SQL's reach -- see /api/push/dispatch and
-- the Database Webhook / pg_net wiring described in the app's own docs for
-- this session. This table only stores what the browser gives us.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_all_own" on public.push_subscriptions;
create policy "push_subscriptions_all_own"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Where the dispatch secret itself lives. Deliberately NOT a row in
-- app_config -- that table has a public app_config_select_all policy
-- (needed so the client can read marketplace_enabled), which would make a
-- secret stored there readable by a plain GET request, defeating the
-- point entirely. This table has RLS enabled with zero policies (same
-- "nothing readable, not even by an admin's own PATCH" idiom already
-- used for roommate_profiles/roommate_requests) -- the only way in is a
-- security definer function that reads it internally, never a direct
-- select from any client.
create table if not exists public.app_secrets (
  key text primary key,
  value text
);

alter table public.app_secrets enable row level security;

insert into public.app_secrets (key, value)
values ('push_dispatch_secret', null)
on conflict (key) do nothing;

-- The dispatch route reads across every user's subscriptions (it's told
-- who to notify by the notifications row, not by the caller's own
-- identity) -- push_subscriptions_all_own would block that entirely, and
-- this app has no service-role key anywhere (a deliberately-audited
-- property, see SECURITY.md) to bypass RLS the usual way. This RPC is
-- security definer (so it CAN bypass RLS) but is gated on a shared secret
-- passed as a parameter and checked against app_secrets, not on the
-- default PUBLIC execute grant every other RPC relies on -- without that
-- check, anyone could call this with any user_id and harvest another
-- user's push endpoint/keys. Only the dispatch route (which knows the
-- matching PUSH_DISPATCH_SECRET env var) can actually get a result back.
create or replace function public.get_push_subscriptions_for_user(p_user_id uuid, p_dispatch_secret text)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_dispatch_secret is null or p_dispatch_secret = ''
     or p_dispatch_secret <> coalesce((select value from public.app_secrets where key = 'push_dispatch_secret'), '')
  then
    raise exception 'Not authorized';
  end if;

  return query select s.endpoint, s.p256dh, s.auth from public.push_subscriptions s where s.user_id = p_user_id;
end;
$$;

grant execute on function public.get_push_subscriptions_for_user(uuid, text) to anon, authenticated;

-- Same secret-gated shape as the lookup above -- the dispatch route needs
-- to garbage-collect a subscription once the push service reports it dead
-- (404/410), and push_subscriptions_all_own would block that too (the
-- route has no user session, just the shared secret).
create or replace function public.delete_dead_push_subscriptions(p_endpoints text[], p_dispatch_secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_dispatch_secret is null or p_dispatch_secret = ''
     or p_dispatch_secret <> coalesce((select value from public.app_secrets where key = 'push_dispatch_secret'), '')
  then
    raise exception 'Not authorized';
  end if;

  delete from public.push_subscriptions where endpoint = any(p_endpoints);
end;
$$;

grant execute on function public.delete_dead_push_subscriptions(text[], text) to anon, authenticated;

-- =========================================================================
-- 6. Admin broadcast
-- =========================================================================

-- New granular permission. set_user_role's own validation list (below) is
-- the only place permission strings are actually enforced -- there's no DB
-- CHECK constraint on admin_permissions (it's a free-form jsonb array),
-- consistent with how every prior permission was added.
create or replace function public.set_user_role(p_user_id uuid, p_role text, p_permissions text[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles%rowtype;
  v_bad_permission text;
begin
  if not public.is_super_admin() then
    raise exception 'Only the super admin can promote or demote admins';
  end if;

  if p_role not in ('student', 'admin') then
    raise exception 'Invalid role: %', p_role;
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  if v_target.is_super_admin then
    raise exception 'Cannot change the super admin''s role';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Cannot remove your own admin access';
  end if;

  if p_permissions is not null then
    select perm into v_bad_permission
    from unnest(p_permissions) as perm
    where perm not in ('manage_hostels', 'manage_users', 'moderate_buzz', 'moderate_reviews', 'moderate_market', 'send_broadcasts')
    limit 1;

    if v_bad_permission is not null then
      raise exception 'Invalid permission: %', v_bad_permission;
    end if;
  end if;

  update public.profiles
  set role = p_role,
      admin_permissions = case
        when p_role = 'admin' then coalesce(to_jsonb(p_permissions), '[]'::jsonb)
        else '[]'::jsonb
      end
  where id = p_user_id;
end;
$$;

-- notifications.type grows one value. Named-constraint drop+recreate --
-- same pattern already used for market_listings_status_check.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'buzz_reply',
    'buzz_like',
    'buzz_pin',
    'hostel_update',
    'admin_report',
    'welcome',
    'admin_broadcast'
  ));

-- A broadcast's optional link is an arbitrary in-app path (e.g. "/market"),
-- not a reference to one specific typed row -- the existing polymorphic
-- reference_type/reference_id pair (buzz_post/buzz_reply/hostel/buzz_report,
-- each an id lookup) doesn't fit, so this is a plain new column rather than
-- overloading that pair with a type it was never meant to hold.
alter table public.notifications add column if not exists link_url text;

-- One row per non-suspended profile, same "system notification, no actor"
-- shape as the existing pin notification. Runs as security definer, which
-- is what actually lets it bypass notifications_insert_none (no client
-- path, including this RPC's caller, can insert directly).
create or replace function public.send_admin_broadcast(p_title text, p_body text, p_link text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.has_permission('send_broadcasts') then
    raise exception 'Not authorized';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'A broadcast needs a title';
  end if;

  insert into public.notifications (recipient_id, type, title, body, actor_id, actor_name, link_url)
  select id, 'admin_broadcast', p_title, p_body, null, 'Campa', nullif(trim(coalesce(p_link, '')), '')
  from public.profiles
  where not is_suspended;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.send_admin_broadcast(text, text, text) to authenticated;

notify pgrst, 'reload schema';
