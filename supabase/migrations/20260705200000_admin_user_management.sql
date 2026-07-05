-- Session 16: Admin User Management
--
-- Everything an admin needs to see who's on the platform and act on an
-- account: a suspend flag, a helper to check it, two write RPCs
-- (role + suspension), a batched activity-count RPC for the users list,
-- and a bulk review-delete RPC for the "one account, several abusive
-- reviews" cleanup case. Reads (the users list itself, a user's reviews/
-- saves/submissions/owned hostels) need no new policies at all --
-- Session 15's `profiles_select_own_or_admin` already lets an admin read
-- every profile, and reviews/submissions/saved_hostels/hostels already
-- OR `is_admin()` into their own SELECT policies (or are public outright,
-- in the case of reviews/hostels). Only the four *writes* below are new.

-- 1. Suspend flag.
alter table public.profiles add column is_suspended boolean not null default false;

-- 2. is_suspended() -- same shape as is_admin(), so it can be dropped into
-- a WITH CHECK clause the same way.
create or replace function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_suspended from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 3. Suspend enforcement, scoped to the two content-creation surfaces the
-- brief actually names ("a student spamming fake reviews or abusive
-- content") -- reviews and submissions. This is a deliberate scope
-- decision, not an oversight: saved_hostels/roommate_* aren't abuse
-- vectors in the same sense, and broadening this to every write policy
-- in the schema would be a much bigger, riskier diff for no real safety
-- gain. See SECURITY.md for the full reasoning.
drop policy "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews for insert
  with check (author_id = auth.uid() and not public.is_suspended());

drop policy "submissions_insert_own" on public.submissions;
create policy "submissions_insert_own"
  on public.submissions for insert
  with check (submitted_by = auth.uid() and not public.is_suspended());

-- 4. Promote/demote. The existing protect_profile_role trigger (Session 2)
-- checks `not public.is_admin()` on the CALLING user, not anything about
-- the row being written or how it's being written -- since this RPC's own
-- guard already requires the caller to be admin, the trigger re-evaluates
-- to "caller is admin" and passes the role change through unmodified. No
-- bypass needed, it was never actually going to block this. SECURITY
-- DEFINER (running as the migration role, which owns public.profiles) is
-- what makes the UPDATE itself legal -- there's no RLS UPDATE policy that
-- lets an admin write a *different* user's row, only the self-only
-- `profiles_update_own`.
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_role not in ('student', 'admin') then
    raise exception 'Invalid role: %', p_role;
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Cannot remove your own admin access';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

-- 5. Suspend/unsuspend.
create or replace function public.set_user_suspended(p_user_id uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_user_id = auth.uid() and p_suspended then
    raise exception 'Cannot suspend your own account';
  end if;

  update public.profiles set is_suspended = p_suspended where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

grant execute on function public.set_user_suspended(uuid, boolean) to authenticated;

-- 6. Batched activity counts for the users list -- one round trip for a
-- whole page of ids, rather than N+1 queries or transferring full rows
-- just to count them. Admin-gated explicitly (matching every other admin
-- RPC's style) even though the underlying selects are already
-- individually RLS-safe for a non-admin caller (reviews are public,
-- submissions/saved_hostels/hostels are self-scoped) -- being explicit
-- here is clearer than relying on that composition.
create or replace function public.get_user_activity_counts(p_user_ids uuid[])
returns table (
  user_id uuid,
  review_count bigint,
  save_count bigint,
  submission_count bigint,
  owned_hostel_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  return query
    select
      u.id,
      (select count(*) from public.reviews r where r.author_id = u.id),
      (select count(*) from public.saved_hostels s where s.user_id = u.id),
      (select count(*) from public.submissions sub where sub.submitted_by = u.id),
      (select count(*) from public.hostels h where h.owner_id = u.id)
    from unnest(p_user_ids) as u(id);
end;
$$;

grant execute on function public.get_user_activity_counts(uuid[]) to authenticated;

-- 7. Bulk review delete -- the "several abusive reviews across hostels,
-- one account" cleanup case named in the brief. The rating trigger
-- (Session 7) recalculates every affected hostel's rating_avg/rating_count
-- as each row is deleted.
create or replace function public.delete_user_reviews(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  delete from public.reviews where author_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.delete_user_reviews(uuid) to authenticated;
