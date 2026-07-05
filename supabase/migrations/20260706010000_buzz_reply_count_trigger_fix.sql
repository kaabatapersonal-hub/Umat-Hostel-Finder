-- Fixes a self-inflicted bug found by the audit script right after
-- applying Session 17's migration: protect_buzz_post_writes unconditionally
-- reset `reply_count` back to its old value on every UPDATE, to stop a
-- client from tampering with it via a direct PATCH. But
-- recalculate_post_reply_count's own legitimate recompute is *also* just
-- an UPDATE on buzz_posts -- so it triggered protect_buzz_post_writes too,
-- which immediately reverted the very count it had just written. Every
-- reply ended up recalculating reply_count back to 0.
--
-- Fix: pg_trigger_depth() is 1 when protect_buzz_post_writes fires
-- directly off a top-level client statement, and >1 when it fires as a
-- side effect of another trigger (handle_buzz_reply_change) already in
-- progress. Only reset reply_count in the depth-1 (real client) case;
-- let a nested (depth>1) call -- the legitimate recompute -- through.
-- author_id doesn't need this distinction, nothing ever legitimately
-- reassigns it from a nested trigger. is_pinned doesn't either, for a
-- different reason: its guard is `not is_admin()`, and auth.uid() stays
-- the original caller's throughout a trigger cascade regardless of
-- nesting depth, so an admin-initiated pin cascading into
-- enforce_buzz_pin_cap's own unpin-the-oldest UPDATE already passes
-- correctly without a depth check.
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

    if new.is_pinned is distinct from old.is_pinned and not public.is_admin() then
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
