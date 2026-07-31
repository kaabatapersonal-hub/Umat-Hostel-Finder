-- Marketplace listing rate limiting.
--
-- Nothing today stops a single account from posting an unlimited number
-- of listings back to back -- market_listings_insert_own only checks
-- seller_id = auth.uid() and not suspended. This adds a per-seller cap,
-- same shape as enforce_buzz_post_rate_limit (20260728000000_buzz_v2.sql):
-- a BEFORE INSERT trigger that counts the seller's own recent rows and
-- raises rather than silently failing, so the client sees a real error
-- message it can react to. Deleted rows don't count toward the count
-- (same as the Buzz precedent) -- this is a rolling window of what's
-- currently on the books, not a lifetime counter.
--
-- Two exemptions, both intentional:
--  1. moderate_market admins -- admin-assisted vendor onboarding (the
--     Marketplace Pre-Launch session) needs to create many listings
--     back-to-back while onboarding several vendors in one sitting.
--  2. Students in Leaving Campus Sale mode -- that feature explicitly
--     encourages bundling many items into one sale in a single sitting
--     when moving out, which would otherwise collide with the hourly cap.
--     Only the hourly cap is waived; the 24-hour cap still applies to
--     everyone, including leaving-sale sellers, as a backstop against a
--     single account listing dozens of items in one day.
create or replace function public.enforce_market_listing_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour_count integer;
  v_day_count integer;
  v_is_leaving_sale boolean;
begin
  if public.has_permission('moderate_market') then
    return new;
  end if;

  select is_leaving_sale into v_is_leaving_sale from public.profiles where id = new.seller_id;

  if not coalesce(v_is_leaving_sale, false) then
    select count(*) into v_hour_count
    from public.market_listings
    where seller_id = new.seller_id and created_at >= now() - interval '1 hour';

    if v_hour_count >= 3 then
      raise exception 'Rate limit: too many listings in the last hour';
    end if;
  end if;

  select count(*) into v_day_count
  from public.market_listings
  where seller_id = new.seller_id and created_at >= now() - interval '24 hours';

  if v_day_count >= 10 then
    raise exception 'Rate limit: too many listings in the last 24 hours';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_market_listing_rate_limit on public.market_listings;
create trigger enforce_market_listing_rate_limit
  before insert on public.market_listings
  for each row execute function public.enforce_market_listing_rate_limit();

notify pgrst, 'reload schema';
