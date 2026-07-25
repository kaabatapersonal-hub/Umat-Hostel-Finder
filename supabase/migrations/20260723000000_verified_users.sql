-- Session 22 Part 1: Verified users
--
-- A personal trust badge (campus influencers, SRC leaders, ...), distinct
-- from the "Official" badge Buzz already shows for admin-authored posts
-- (protect_buzz_post_writes' is_admin_post) -- that one means "an admin
-- wrote this," this one means "this specific person is trusted,"
-- independent of role.
--
-- Verification must show on content the verified user *already* posted,
-- not just future posts -- unlike author_name/reviewer_name (which are
-- denormalized once at insert time because names rarely change), baking
-- is_verified into buzz_posts/buzz_replies/reviews at write time would
-- mean a newly-verified influencer's whole post history stays unbadged
-- until they post again. Instead, get_verified_profiles is a small public
-- batch lookup (same shape as get_user_activity_counts, but anon-callable
-- and returning only the two safe fields) -- every feed fetches it once
-- for the author ids on screen and merges client-side.

alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists verification_label text;

-- Extends protect_profile_role (Session 2) rather than adding a second
-- trigger -- one BEFORE UPDATE trigger per table stays easier to reason
-- about than several stacked ones. is_admin()-gated for now; Part 2 of
-- this session redefines this again once has_permission() exists, to
-- gate on the finer-grained 'manage_users' permission instead.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;

  if (new.is_verified is distinct from old.is_verified or new.verification_label is distinct from old.verification_label)
     and not public.is_admin() then
    new.is_verified := old.is_verified;
    new.verification_label := old.verification_label;
  end if;

  return new;
end;
$$;

-- Verify/unverify. is_admin()-gated for now, same reasoning as above --
-- Part 2 redefines this to require has_permission('manage_users').
create or replace function public.set_user_verified(p_user_id uuid, p_verified boolean, p_label text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.profiles
  set is_verified = p_verified,
      verification_label = case when p_verified then nullif(trim(p_label), '') else null end
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

grant execute on function public.set_user_verified(uuid, boolean, text) to authenticated;

-- Public, anon-callable batch lookup -- only ever returns rows for
-- verified users, and only the two fields that are safe to show anyone
-- (never email/role/suspension status). Called once per rendered batch
-- of authors (a Buzz page, a hostel's reviews, ...), not once per row.
create or replace function public.get_verified_profiles(p_user_ids uuid[])
returns table (id uuid, verification_label text)
language sql
stable
security definer
set search_path = public
as $$
  select id, verification_label
  from public.profiles
  where id = any(p_user_ids) and is_verified = true;
$$;

grant execute on function public.get_verified_profiles(uuid[]) to anon, authenticated;

-- get_seller_public_profile (Session 19, extended in Session 20) grows
-- verification too -- a listing/seller detail view is a single-item
-- lookup, not a batch of many, so it's simpler to fold in here than to
-- also call get_verified_profiles for one id.
drop function if exists public.get_seller_public_profile(uuid);
create function public.get_seller_public_profile(p_seller_id uuid)
returns table (
  full_name text,
  created_at timestamptz,
  is_leaving_sale boolean,
  leaving_date date,
  is_verified boolean,
  verification_label text
)
language sql
stable
security definer
set search_path = public
as $$
  select full_name, created_at, is_leaving_sale, leaving_date, is_verified, verification_label
  from public.profiles
  where id = p_seller_id;
$$;

grant execute on function public.get_seller_public_profile(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
