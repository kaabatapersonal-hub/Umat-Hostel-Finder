-- Session 22 Part 2 fixes, found by running the live audit right after
-- applying the three Session 22 migrations.
--
-- 1. set_user_role(uuid, text) -- the original Session 16 signature --
--    was left in place while set_user_role(uuid, text, text[] default
--    null) was added alongside it ("extend it, don't rebuild" was about
--    the RPC's *behavior*, not about literally keeping the old overload
--    around). PostgREST calls RPCs with named-parameter notation, and
--    when a 2-argument call can match BOTH the exact 2-arg function AND
--    the 3-arg function via its default, PostgREST refuses to guess --
--    it returns a "Could not choose the best candidate function" error.
--    Every existing call site (the admin panel's promote/demote button,
--    and most of the audit script) calls with just p_user_id/p_role, so
--    this broke promotion and demotion outright. Dropping the old
--    overload leaves the 3-arg version as the only candidate.
drop function if exists public.set_user_role(uuid, text);

-- 2. Two write-protection triggers still had their own separate
--    `not is_admin()` guard left over from before permissions existed,
--    even though the RLS policy gating the same UPDATE was already
--    retrofitted to the specific permission. That's not exploitable
--    through a stranger (RLS blocks them first), but it IS exploitable
--    by a sub-admin acting on their own row, where RLS already lets
--    them through as the author/seller: a sub-admin with e.g. only
--    moderate_reviews could still pin their own Buzz post or remove
--    their own listing, because these triggers only checked "is this
--    caller *any* admin," not "does this caller specifically have
--    moderate_buzz / moderate_market."
create or replace function public.protect_buzz_post_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.author_id := old.author_id;

    if pg_trigger_depth() <= 1 then
      new.reply_count := old.reply_count;
    end if;

    if new.is_pinned is distinct from old.is_pinned and not public.has_permission('moderate_buzz') then
      new.is_pinned := old.is_pinned;
    end if;
  end if;

  select full_name into new.author_name from public.profiles where id = new.author_id;
  new.is_admin_post := exists (
    select 1 from public.profiles where id = new.author_id and role = 'admin'
  );

  return new;
end;
$$;

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

    if new.status = 'removed' and old.status <> 'removed' and not public.has_permission('moderate_market') then
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

notify pgrst, 'reload schema';
