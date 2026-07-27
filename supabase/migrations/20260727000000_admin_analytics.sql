-- Admin Analytics tab: growth + engagement stat cards.
--
-- Every number except one is a plain PostgREST count query straight from
-- the client, same zero-RPC pattern lib/queries/admin-stats.ts already
-- uses for the Dashboard -- profiles/saved_hostels already have an
-- is_admin()-inclusive SELECT policy (saved_hostels_select_admin,
-- Session 10), and reviews/buzz_posts/market_listings are already fully
-- public-read, so a 30-day-window count is just an extra `.gte()` filter
-- on a query shape that already exists. No new RLS needed for any of
-- that.
--
-- "Active users (7d)" is the one number that can't be a plain PostgREST
-- query -- it's a distinct-user count across four different tables
-- (saved_hostels.user_id, reviews.author_id, buzz_posts.author_id,
-- market_listings.seller_id), which needs a real UNION, not something
-- PostgREST's query builder can express client-side. This is the one
-- new RPC this feature needs.
create or replace function public.get_active_users_count(p_since timestamptz)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return (
    select count(*)::integer from (
      select user_id from public.saved_hostels where created_at >= p_since
      union
      select author_id from public.reviews where created_at >= p_since
      union
      select author_id from public.buzz_posts where created_at >= p_since
      union
      select seller_id from public.market_listings where created_at >= p_since
    ) as active_users(user_id)
  );
end;
$$;

-- Not gated on any specific has_permission() key, deliberately -- the
-- brief wants Analytics visible to the super admin AND every sub-admin
-- regardless of their individual permission set, same as the Dashboard
-- tab itself (admin-shell.tsx's TABS entry for "/admin" has no
-- `permission` field either). is_admin() is the right and only gate
-- here, matching how every other admin *read* in this app stays broadly
-- admin-gated (see SECURITY.md's Session 22 Part 2 "reads stay on
-- is_admin()" note) -- only writes get the finer has_permission() split.
grant execute on function public.get_active_users_count(timestamptz) to authenticated;

notify pgrst, 'reload schema';
