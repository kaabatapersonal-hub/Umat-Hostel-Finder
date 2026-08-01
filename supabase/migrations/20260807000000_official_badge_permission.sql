-- The "Official" badge on Buzz posts was tied to blanket role = 'admin',
-- so every sub-admin (even one only granted e.g. moderate_reviews) had
-- every post auto-badged Official. Split it into its own granular
-- permission, post_as_official, so the super admin decides who actually
-- gets to post as Official rather than it being an automatic side effect
-- of any admin promotion. Super admins keep it unconditionally (same
-- posture as every other has_permission() call in this app).

create or replace function public.protect_buzz_post_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_avatar_color text;
begin
  if tg_op = 'UPDATE' then
    new.author_id := old.author_id;
    new.is_anonymous := old.is_anonymous;

    if pg_trigger_depth() <= 1 then
      new.reply_count := old.reply_count;
    end if;

    if new.is_pinned is distinct from old.is_pinned and not public.has_permission('moderate_buzz') then
      new.is_pinned := old.is_pinned;
    end if;
  end if;

  select username, avatar_color into v_username, v_avatar_color
  from public.profiles where id = new.author_id;

  if new.is_anonymous then
    new.author_name := 'Student';
    new.author_avatar_color := null;
  else
    new.author_name := coalesce(v_username, 'Student');
    new.author_avatar_color := v_avatar_color;
  end if;

  new.is_admin_post := exists (
    select 1 from public.profiles
    where id = new.author_id
      and role = 'admin'
      and (is_super_admin or admin_permissions ? 'post_as_official')
  );

  return new;
end;
$$;

-- Recompute existing posts against the new rule immediately -- a
-- sub-admin's past posts should lose the badge right away, not just
-- future ones.
update public.buzz_posts
set is_admin_post = exists (
  select 1 from public.profiles p
  where p.id = buzz_posts.author_id
    and p.role = 'admin'
    and (p.is_super_admin or p.admin_permissions ? 'post_as_official')
)
where is_admin_post = true;

-- set_user_role: extend the valid-permission allowlist with post_as_official.
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
    where perm not in ('manage_hostels', 'manage_users', 'moderate_buzz', 'moderate_reviews', 'moderate_market', 'send_broadcasts', 'post_as_official')
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

notify pgrst, 'reload schema';
