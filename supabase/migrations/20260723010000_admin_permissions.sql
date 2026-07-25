-- Session 22 Part 2: Admin role permissions (super admin vs sub-admin)
--
-- Today `role = 'admin'` is all-or-nothing -- anyone promoted can do
-- everything, including promoting others. This migration introduces a
-- single super admin (kaabatapersonal@gmail.com) who keeps full control,
-- and sub-admins who only get the specific permissions granted to them.
-- Every existing admin-gated RLS policy and RPC below is *retrofitted*,
-- not left on the old blanket is_admin() check -- a sub-admin without
-- moderate_buzz, for instance, must be rejected by the database itself
-- if they try to delete a Buzz post via a direct API call, not just
-- have the button hidden in the UI.
--
-- Reads stay admin-gated on plain is_admin() (any admin, regardless of
-- specific permissions) -- this migration only tightens *writes*. Every
-- admin surface still needs to read a mix of data to render at all
-- (e.g. the dashboard's own stat counts), and the brief's own "dashboard
-- shows counts for permitted areas" is a client-side display decision,
-- not a server-side read restriction.

alter table public.profiles add column if not exists is_super_admin boolean not null default false;
alter table public.profiles add column if not exists admin_permissions jsonb not null default '[]';

-- One-time bootstrap. Never settable through the app after this -- no
-- RPC, no UI, ever touches is_super_admin (protect_profile_role below
-- locks it completely).
update public.profiles set is_super_admin = true where email = 'kaabatapersonal@gmail.com';

-- Any admin that already existed before this migration (besides the
-- super admin) gets a safe, limited default rather than silently losing
-- every capability they were already using, or silently keeping
-- everything (which would defeat the point of this session).
update public.profiles
set admin_permissions = '["moderate_buzz", "moderate_reviews"]'::jsonb
where role = 'admin' and is_super_admin = false;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;

-- Same shape as is_admin()/is_suspended() -- security definer + fixed
-- search_path so it can be dropped into RLS policies (including
-- profiles' own) without recursive-RLS issues. 'manage_admins' is never
-- checked here -- promote/demote/set-permissions go through
-- is_super_admin() directly (see set_user_role below), not this array.
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role = 'admin' and (is_super_admin or admin_permissions ? p_permission)
      from public.profiles
      where id = auth.uid()
    ),
    false
  );
$$;

-- protect_profile_role, redefined a second time this session (Part 1
-- already extended it once, for is_verified/verification_label) --
-- role changes now require is_super_admin(), not just is_admin();
-- admin_permissions gets the same never-client-settable-without-
-- permission protection; is_super_admin itself can never change through
-- any write path (only the one-time UPDATE above ever sets it); and
-- once a row has is_super_admin = true, its role can never change again
-- by anyone -- including the super admin acting on themselves -- the
-- "cannot be demoted" safety net the brief explicitly asks for.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_super_admin() then
    new.role := old.role;
  end if;

  if old.is_super_admin and new.role is distinct from old.role then
    new.role := old.role;
  end if;

  if (new.is_verified is distinct from old.is_verified or new.verification_label is distinct from old.verification_label)
     and not public.has_permission('manage_users') then
    new.is_verified := old.is_verified;
    new.verification_label := old.verification_label;
  end if;

  if new.admin_permissions is distinct from old.admin_permissions and not public.is_super_admin() then
    new.admin_permissions := old.admin_permissions;
  end if;

  if new.is_super_admin is distinct from old.is_super_admin then
    new.is_super_admin := old.is_super_admin;
  end if;

  return new;
end;
$$;

-- set_user_role: extended (per the brief -- "extend it, don't rebuild"),
-- not replaced. Super-admin-only now (was any admin); also sets
-- admin_permissions in the same statement, validated against the known
-- key set so a typo'd or made-up permission can't silently do nothing.
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
    where perm not in ('manage_hostels', 'manage_users', 'moderate_buzz', 'moderate_reviews', 'moderate_market')
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

grant execute on function public.set_user_role(uuid, text, text[]) to authenticated;

-- set_user_suspended: manage_users instead of any-admin. Also blocks
-- suspending the super admin -- the same safety net as "cannot be
-- demoted," extended here since a sub-admin with manage_users could
-- otherwise lock the super admin's own account out.
create or replace function public.set_user_suspended(p_user_id uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('manage_users') then
    raise exception 'Not authorized';
  end if;

  if p_user_id = auth.uid() and p_suspended then
    raise exception 'Cannot suspend your own account';
  end if;

  if p_suspended and exists (select 1 from public.profiles where id = p_user_id and is_super_admin) then
    raise exception 'Cannot suspend the super admin';
  end if;

  update public.profiles set is_suspended = p_suspended where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

-- get_user_activity_counts: manage_users instead of any-admin.
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
  if not public.has_permission('manage_users') then
    raise exception 'Not authorized';
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

-- delete_user_reviews: moderate_reviews (it deletes review rows, matching
-- what that permission is actually about), not manage_users (the tab
-- it's exposed from in the UI).
create or replace function public.delete_user_reviews(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.has_permission('moderate_reviews') then
    raise exception 'Not authorized';
  end if;

  delete from public.reviews where author_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- set_user_verified (Session 22 Part 1 of this same session): re-gated
-- on manage_users instead of any-admin, now that has_permission() exists.
create or replace function public.set_user_verified(p_user_id uuid, p_verified boolean, p_label text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('manage_users') then
    raise exception 'Not authorized';
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

-- apply_pending_changes / approve_submission / reject_submission:
-- manage_hostels instead of any-admin.
create or replace function public.apply_pending_changes(p_hostel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb;
begin
  if not public.has_permission('manage_hostels') then
    raise exception 'Not authorized';
  end if;

  select pending_changes into v_changes from public.hostels where id = p_hostel_id;
  if v_changes is null then
    raise exception 'No pending changes for this hostel';
  end if;

  update public.hostels
  set
    name = coalesce(v_changes ->> 'name', name),
    description = v_changes ->> 'description',
    location = coalesce(v_changes ->> 'location', location),
    distance_text = v_changes ->> 'distance_text',
    room_types = coalesce(v_changes -> 'room_types', room_types),
    images = coalesce(v_changes -> 'images', images),
    facilities = coalesce(
      (select array_agg(elem) from jsonb_array_elements_text(v_changes -> 'facilities') as elem),
      facilities
    ),
    contact = coalesce(v_changes ->> 'contact', contact),
    call_number = v_changes ->> 'call_number',
    latitude = (v_changes ->> 'latitude')::double precision,
    longitude = (v_changes ->> 'longitude')::double precision,
    tags = coalesce(
      (select array_agg(elem) from jsonb_array_elements_text(v_changes -> 'tags') as elem),
      tags
    ),
    pending_changes = null,
    has_pending_edit = false
  where id = p_hostel_id;
end;
$$;

create or replace function public.approve_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
  v_hostel_id uuid;
begin
  if not public.has_permission('manage_hostels') then
    raise exception 'Not authorized';
  end if;

  select * into v_submission from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if v_submission.status <> 'pending' then
    raise exception 'Submission is not pending';
  end if;

  insert into public.hostels (
    owner_id, name, location, distance_text, description, room_types,
    images, facilities, contact, call_number, latitude, longitude, tags
  ) values (
    v_submission.submitted_by, v_submission.name, v_submission.location, v_submission.distance_text,
    v_submission.description, v_submission.room_types, v_submission.images, v_submission.facilities,
    v_submission.contact, v_submission.call_number, v_submission.latitude, v_submission.longitude,
    v_submission.tags
  )
  returning id into v_hostel_id;

  update public.submissions set status = 'approved' where id = p_submission_id;

  return v_hostel_id;
end;
$$;

create or replace function public.reject_submission(p_submission_id uuid, p_admin_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('manage_hostels') then
    raise exception 'Not authorized';
  end if;

  update public.submissions
  set status = 'rejected', admin_note = p_admin_note
  where id = p_submission_id and status = 'pending';

  if not found then
    raise exception 'Submission not found or not pending';
  end if;
end;
$$;

-- toggle_marketplace: moderate_market instead of any-admin.
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

  return v_new_value = 'true'::jsonb;
end;
$$;

-- hostels: manage_hostels.
drop policy if exists "hostels_insert_admin" on public.hostels;
create policy "hostels_insert_admin"
  on public.hostels for insert
  with check (public.has_permission('manage_hostels'));

drop policy if exists "hostels_update_admin" on public.hostels;
create policy "hostels_update_admin"
  on public.hostels for update
  using (public.has_permission('manage_hostels'))
  with check (public.has_permission('manage_hostels'));

drop policy if exists "hostels_delete_admin" on public.hostels;
create policy "hostels_delete_admin"
  on public.hostels for delete
  using (public.has_permission('manage_hostels'));

-- submissions: manage_hostels (admin branch of the update/delete
-- policies -- select stays is_admin()-gated, a read, not a write).
drop policy if exists "submissions_update_admin" on public.submissions;
create policy "submissions_update_admin"
  on public.submissions for update
  using (public.has_permission('manage_hostels'))
  with check (public.has_permission('manage_hostels'));

drop policy if exists "submissions_delete_admin" on public.submissions;
create policy "submissions_delete_admin"
  on public.submissions for delete
  using (public.has_permission('manage_hostels'));

-- reviews: moderate_reviews (admin branch only -- author_id = auth.uid()
-- OR clause is untouched, an author can still edit/delete their own).
drop policy if exists "reviews_update_author_or_admin" on public.reviews;
create policy "reviews_update_author_or_admin"
  on public.reviews for update
  using (author_id = auth.uid() or public.has_permission('moderate_reviews'))
  with check (author_id = auth.uid() or public.has_permission('moderate_reviews'));

drop policy if exists "reviews_delete_author_or_admin" on public.reviews;
create policy "reviews_delete_author_or_admin"
  on public.reviews for delete
  using (author_id = auth.uid() or public.has_permission('moderate_reviews'));

-- buzz_posts / buzz_replies: moderate_buzz (admin branch only).
drop policy if exists "buzz_posts_update_author_or_admin" on public.buzz_posts;
create policy "buzz_posts_update_author_or_admin"
  on public.buzz_posts for update
  using (author_id = auth.uid() or public.has_permission('moderate_buzz'))
  with check (author_id = auth.uid() or public.has_permission('moderate_buzz'));

drop policy if exists "buzz_posts_delete_author_or_admin" on public.buzz_posts;
create policy "buzz_posts_delete_author_or_admin"
  on public.buzz_posts for delete
  using (author_id = auth.uid() or public.has_permission('moderate_buzz'));

drop policy if exists "buzz_replies_delete_author_or_admin" on public.buzz_replies;
create policy "buzz_replies_delete_author_or_admin"
  on public.buzz_replies for delete
  using (author_id = auth.uid() or public.has_permission('moderate_buzz'));

-- market_listings: moderate_market (admin branch only).
drop policy if exists "market_listings_update_seller_or_admin" on public.market_listings;
create policy "market_listings_update_seller_or_admin"
  on public.market_listings for update
  using (seller_id = auth.uid() or public.has_permission('moderate_market'))
  with check (seller_id = auth.uid() or public.has_permission('moderate_market'));

drop policy if exists "market_listings_delete_seller_or_admin" on public.market_listings;
create policy "market_listings_delete_seller_or_admin"
  on public.market_listings for delete
  using (seller_id = auth.uid() or public.has_permission('moderate_market'));

-- app_config: moderate_market -- its only row today (marketplace_enabled)
-- is exactly what that permission is about; revisit this mapping if
-- app_config ever grows to hold unrelated settings.
drop policy if exists "app_config_insert_admin" on public.app_config;
create policy "app_config_insert_admin"
  on public.app_config for insert
  with check (public.has_permission('moderate_market'));

drop policy if exists "app_config_update_admin" on public.app_config;
create policy "app_config_update_admin"
  on public.app_config for update
  using (public.has_permission('moderate_market'))
  with check (public.has_permission('moderate_market'));

notify pgrst, 'reload schema';
