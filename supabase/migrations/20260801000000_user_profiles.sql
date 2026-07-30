-- User profile system upgrade: optional usernames, bios, contact numbers,
-- a public profile page, clickable authors on Buzz, and anonymous
-- posting. Extends the existing profiles table (not a new one) and
-- extends buzz_posts/buzz_replies' existing author denormalization
-- triggers rather than introducing a parallel lookup mechanism.

-- =========================================================================
-- 1. profiles: new columns
-- =========================================================================

alter table public.profiles add column if not exists username text
  check (username is null or (char_length(username) <= 30 and username ~ '^[a-zA-Z0-9_ ]+$'));
alter table public.profiles add column if not exists bio text
  check (bio is null or char_length(bio) <= 150);
-- International format (233XXXXXXXXX), same convention as the rest of
-- the app's contact-number handling (see src/lib/contact.ts) -- stored
-- normalized, converted for display client-side.
alter table public.profiles add column if not exists whatsapp_number text;
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists avatar_color text;

-- No new RLS needed for reading/writing these columns: profiles_select_all
-- (using(true), from the very first profiles migration) already covers
-- public reads, and profiles_update_own already covers self-updates. Only
-- role/is_verified/is_super_admin/admin_permissions have ever needed a
-- dedicated protection trigger (privilege escalation vectors); a vanity
-- username/bio/contact number/avatar color is not one, so none of the new
-- columns need similar protection.

-- One-time backfill so EXISTING accounts also get a colored avatar
-- immediately, rather than everyone showing the default gray "S" until
-- they individually save their profile once.
do $$
declare
  v_palette text[] := array['#E8A33D', '#3B82F6', '#10B981', '#8B5CF6', '#F43F5E', '#06B6D4', '#F59E0B', '#6366F1'];
begin
  update public.profiles
  set avatar_color = v_palette[1 + floor(random() * array_length(v_palette, 1))::int]
  where avatar_color is null;
end $$;

-- Assign a color to every future signup too.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_palette text[] := array['#E8A33D', '#3B82F6', '#10B981', '#8B5CF6', '#F43F5E', '#06B6D4', '#F59E0B', '#6366F1'];
begin
  insert into public.profiles (id, email, full_name, avatar_url, avatar_color)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    v_palette[1 + floor(random() * array_length(v_palette, 1))::int]
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- =========================================================================
-- 2. Public profile lookup -- mirrors get_seller_public_profile's own
--    posture exactly (security definer, never exposes email/role/admin
--    fields), even though profiles_select_all already permits a direct
--    select -- this keeps every public-facing profile read going through
--    one narrow, intentional surface rather than each caller re-deciding
--    which columns are safe to show.
-- =========================================================================

drop function if exists public.get_public_profile(uuid);
create function public.get_public_profile(p_user_id uuid)
returns table (
  username text,
  bio text,
  whatsapp_number text,
  phone_number text,
  avatar_color text,
  is_verified boolean,
  verification_label text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select username, bio, whatsapp_number, phone_number, avatar_color, is_verified, verification_label, created_at
  from public.profiles
  where id = p_user_id;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- =========================================================================
-- 3. buzz_posts: anonymous posting + denormalized avatar color
-- =========================================================================

alter table public.buzz_posts add column if not exists is_anonymous boolean not null default false;
-- Denormalized exactly like author_name already is -- avatar_color is
-- immutable post-signup (no edit UI for it), so unlike username there is
-- no staleness concern re-reading it here on every future post/update.
alter table public.buzz_posts add column if not exists author_avatar_color text;
alter table public.buzz_replies add column if not exists author_avatar_color text;

-- Same function, extended: author_name now prefers username over
-- full_name (falling back to 'Student' either way), is_anonymous is
-- locked after creation (can't be toggled retroactively in either
-- direction), and an anonymous post's author_avatar_color is stored as
-- null so <UserAvatar> renders the neutral default rather than the
-- poster's real color -- their identity should not leak through the
-- avatar's color once they've chosen to post anonymously.
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
    select 1 from public.profiles where id = new.author_id and role = 'admin'
  );

  return new;
end;
$$;

create or replace function public.set_buzz_reply_author_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_avatar_color text;
begin
  -- Replies are never anonymous (see the migration's own top-of-file
  -- note) -- always the real username/avatar, falling back to 'Student'
  -- only when no username has been set.
  select username, avatar_color into v_username, v_avatar_color
  from public.profiles where id = new.author_id;

  new.author_name := coalesce(v_username, 'Student');
  new.author_avatar_color := v_avatar_color;
  return new;
end;
$$;

-- =========================================================================
-- 4. get_hot_buzz_posts must also return the two new columns
-- =========================================================================

drop function if exists public.get_hot_buzz_posts(double precision, timestamptz, uuid, int);

create or replace function public.get_hot_buzz_posts(
  p_cursor_score double precision default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 20
)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  content text,
  is_admin_post boolean,
  is_pinned boolean,
  reply_count integer,
  like_count integer,
  view_count integer,
  is_anonymous boolean,
  author_avatar_color text,
  created_at timestamptz,
  hot_score double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  with scored as (
    select
      p.id, p.author_id, p.author_name, p.content, p.is_admin_post, p.is_pinned,
      p.reply_count, p.like_count, p.view_count, p.is_anonymous, p.author_avatar_color, p.created_at,
      p.like_count::double precision / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.5) as hot_score
    from public.buzz_posts p
    where p.is_pinned = false
  )
  select *
  from scored
  where
    p_cursor_score is null
    or hot_score < p_cursor_score
    or (hot_score = p_cursor_score and created_at < p_cursor_created_at)
    or (hot_score = p_cursor_score and created_at = p_cursor_created_at and id < p_cursor_id)
  order by hot_score desc, created_at desc, id desc
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.get_hot_buzz_posts(double precision, timestamptz, uuid, int) to anon, authenticated;

notify pgrst, 'reload schema';
