-- Platform-wide in-app notification system (Session: Notifications).
-- One table covers every notification type across Buzz, Hostels, and
-- Admin. In-app only -- no push notifications yet. Nothing from any
-- prior migration is touched.

-- =========================================================================
-- 1. notifications table
-- =========================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'buzz_reply',
    'buzz_like',
    'buzz_pin',
    'hostel_update',
    'admin_report',
    'welcome'
  )),
  title text not null,
  body text,
  -- Who triggered it; null for system notifications (pin, hostel update,
  -- welcome). set null (not cascade) on the actor's own deletion -- the
  -- notification itself is still meaningful ("someone replied") even if
  -- that someone's account is later gone, same posture as
  -- buzz_reports.reviewed_by.
  actor_id uuid references public.profiles (id) on delete set null,
  -- Denormalized so the notification list never needs a join back to
  -- profiles just to render a name -- same reasoning as
  -- buzz_posts.author_name.
  actor_name text,
  -- Polymorphic reference (post / reply / hostel / report) -- no FK is
  -- possible across four different target tables from one column, so
  -- integrity here is enforced by the explicit cleanup trigger below
  -- (handle_buzz_post_deleted_cleanup_notifications) rather than a
  -- database constraint.
  reference_type text check (reference_type in ('buzz_post', 'buzz_reply', 'hostel', 'buzz_report')),
  reference_id uuid,
  -- Batching key for high-frequency types (currently just buzz_like) --
  -- e.g. 'buzz_like:{post_id}'. Null for every non-batched type, where
  -- each event is always its own row.
  group_key text,
  group_count integer not null default 1,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Primary query pattern: "my unread notifications, newest first."
create index if not exists notifications_recipient_unread_created_idx
  on public.notifications (recipient_id, is_read, created_at desc);

-- Batching lookup for Trigger B (find the live buzz_like group to update).
create index if not exists notifications_group_key_idx on public.notifications (group_key);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (recipient_id = auth.uid());

-- No client-side inserts at all -- every row is created by a security-
-- definer trigger function below, which bypasses RLS entirely as the
-- function owner. This policy exists as defense in depth, not the actual
-- enforcement mechanism.
drop policy if exists "notifications_insert_none" on public.notifications;
create policy "notifications_insert_none"
  on public.notifications for insert
  with check (false);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete
  using (recipient_id = auth.uid());

-- Lets clients subscribe to postgres_changes for their own row set (see
-- notifications-realtime-sync.tsx) -- Realtime respects the table's own
-- RLS select policy for filtering what a given client actually receives.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Cleanup note: this table will grow unbounded (a row per reply/like-
-- group/report/etc. forever). No auto-cleanup is implemented yet -- once
-- this grows large, add a scheduled job (pg_cron or an edge function) to
-- delete read notifications older than ~90 days.

-- =========================================================================
-- 2. Trigger A -- buzz_reply -> notify the post's author
-- =========================================================================

create or replace function public.handle_buzz_reply_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author_id uuid;
begin
  select author_id into v_post_author_id from public.buzz_posts where id = new.post_id;

  -- No self-notification, and nothing to notify if the post is already gone.
  if v_post_author_id is null or v_post_author_id = new.author_id then
    return new;
  end if;

  insert into public.notifications (recipient_id, type, title, body, actor_id, actor_name, reference_type, reference_id)
  values (
    v_post_author_id,
    'buzz_reply',
    coalesce(new.author_name, 'Someone') || ' replied to your post',
    case when new.gif_url is not null then 'Sent a GIF' else left(new.content, 80) end,
    new.author_id,
    new.author_name,
    'buzz_post',
    new.post_id
  );

  return new;
end;
$$;

drop trigger if exists buzz_replies_notify on public.buzz_replies;
create trigger buzz_replies_notify
  after insert on public.buzz_replies
  for each row execute function public.handle_buzz_reply_notification();

-- =========================================================================
-- 3. Trigger B -- buzz_like -> notify the post's author (batched)
-- =========================================================================

create or replace function public.handle_buzz_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author_id uuid;
  v_liker_name text;
  v_group_key text;
  v_existing_id uuid;
begin
  select author_id into v_post_author_id from public.buzz_posts where id = new.post_id;
  if v_post_author_id is null or v_post_author_id = new.user_id then
    return new;
  end if;

  select full_name into v_liker_name from public.profiles where id = new.user_id;
  v_group_key := 'buzz_like:' || new.post_id::text;

  -- Fold into an existing live batch (unread, started within the last 30
  -- minutes) rather than spamming one row per like -- a popular post
  -- getting liked 20 times in a minute should read as one updating
  -- notification, not 20 separate ones.
  select id into v_existing_id
  from public.notifications
  where group_key = v_group_key
    and is_read = false
    and created_at > now() - interval '30 minutes'
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    update public.notifications
    set
      group_count = group_count + 1,
      title = (group_count + 1) || ' people 🔥''d your post',
      actor_id = new.user_id,
      actor_name = v_liker_name,
      updated_at = now()
    where id = v_existing_id;
  else
    insert into public.notifications (recipient_id, type, title, actor_id, actor_name, reference_type, reference_id, group_key, group_count)
    values (
      v_post_author_id,
      'buzz_like',
      coalesce(v_liker_name, 'Someone') || ' 🔥''d your post',
      new.user_id,
      v_liker_name,
      'buzz_post',
      new.post_id,
      v_group_key,
      1
    );
  end if;

  return new;
end;
$$;

drop trigger if exists buzz_likes_notify on public.buzz_likes;
create trigger buzz_likes_notify
  after insert on public.buzz_likes
  for each row execute function public.handle_buzz_like_notification();

-- =========================================================================
-- 4. Trigger C -- buzz_pin -> notify the post's author
-- =========================================================================

create or replace function public.handle_buzz_pin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, type, title, body, actor_id, actor_name, reference_type, reference_id)
  values (
    new.author_id,
    'buzz_pin',
    'Your post was pinned by Campa 📌',
    left(new.content, 80),
    null,
    'Campa',
    'buzz_post',
    new.id
  );
  return new;
end;
$$;

-- The WHEN clause (not an `if` inside the function body) means this
-- never even invokes the function for the far more common buzz_posts
-- updates (content edits, like_count/reply_count recompute, etc.) --
-- only an actual false -> true pin transition triggers it at all.
drop trigger if exists buzz_posts_notify_pin on public.buzz_posts;
create trigger buzz_posts_notify_pin
  after update on public.buzz_posts
  for each row
  when (old.is_pinned = false and new.is_pinned = true)
  execute function public.handle_buzz_pin_notification();

-- =========================================================================
-- 5. Trigger D -- hostel availability change -> notify everyone who saved it
-- =========================================================================
-- saved_hostels(user_id, hostel_id) is the real saves table (confirmed
-- against supabase/migrations/20260702182916_saved_hostels.sql). A single
-- INSERT ... SELECT, not a per-row loop, so this stays cheap even for a
-- hostel with hundreds of savers.

create or replace function public.handle_hostel_availability_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, type, title, actor_id, actor_name, reference_type, reference_id)
  select
    sh.user_id,
    'hostel_update',
    new.name || ' is now ' || initcap(new.availability),
    null,
    'Campa',
    'hostel',
    new.id
  from public.saved_hostels sh
  where sh.hostel_id = new.id;
  return new;
end;
$$;

-- WHEN clause, not an `if` inside the function -- a hostel's other
-- fields (price, description, room types) change far more often than
-- its availability, and none of those should even invoke this function.
drop trigger if exists hostels_notify_availability on public.hostels;
create trigger hostels_notify_availability
  after update on public.hostels
  for each row
  when (old.availability is distinct from new.availability)
  execute function public.handle_hostel_availability_notification();

-- =========================================================================
-- 6. Trigger E -- new buzz_report -> notify every admin with moderate_buzz
-- =========================================================================

create or replace function public.handle_buzz_report_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter_name text;
  v_preview text;
begin
  select full_name into v_reporter_name from public.profiles where id = new.reporter_id;

  if new.post_id is not null then
    select left(content, 80) into v_preview from public.buzz_posts where id = new.post_id;
  elsif new.reply_id is not null then
    select case when gif_url is not null then '[GIF reply]' else left(content, 80) end
      into v_preview from public.buzz_replies where id = new.reply_id;
  end if;

  insert into public.notifications (recipient_id, type, title, body, actor_id, actor_name, reference_type, reference_id)
  select
    p.id,
    'admin_report',
    'New Buzz report: ' || new.reason,
    v_preview,
    new.reporter_id,
    v_reporter_name,
    'buzz_report',
    new.id
  from public.profiles p
  where p.role = 'admin' and (p.is_super_admin or p.admin_permissions ? 'moderate_buzz');

  return new;
end;
$$;

drop trigger if exists buzz_reports_notify_admins on public.buzz_reports;
create trigger buzz_reports_notify_admins
  after insert on public.buzz_reports
  for each row execute function public.handle_buzz_report_notification();

-- =========================================================================
-- 7. Trigger F -- welcome notification on signup
-- =========================================================================
-- A dedicated AFTER INSERT trigger on profiles, not folded into
-- handle_new_user() -- keeps "create the account" and "welcome the
-- account" as separate concerns, and correctly fires exactly once even
-- though handle_new_user's own insert uses ON CONFLICT DO NOTHING (a
-- skipped insert never reaches this trigger at all).

create or replace function public.handle_new_profile_welcome_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, type, title, body, actor_id, actor_name)
  values (
    new.id,
    'welcome',
    'Welcome to Campa! 🎓',
    'Find hostels, connect with students, and explore campus life.',
    null,
    'Campa'
  );
  return new;
end;
$$;

drop trigger if exists profiles_notify_welcome on public.profiles;
create trigger profiles_notify_welcome
  after insert on public.profiles
  for each row execute function public.handle_new_profile_welcome_notification();

-- =========================================================================
-- 8. Cleanup -- deleting a post removes notifications that point at it
-- =========================================================================
-- No FK cascade is possible on the polymorphic reference_id, so this is
-- the explicit substitute: a stale notification linking to a post that no
-- longer exists is worse UX than no notification at all.

create or replace function public.handle_buzz_post_deleted_cleanup_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications where reference_type = 'buzz_post' and reference_id = old.id;
  return old;
end;
$$;

drop trigger if exists buzz_posts_cleanup_notifications on public.buzz_posts;
create trigger buzz_posts_cleanup_notifications
  after delete on public.buzz_posts
  for each row execute function public.handle_buzz_post_deleted_cleanup_notifications();

-- =========================================================================
-- 9. RPCs
-- =========================================================================

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.notifications
  set is_read = true, updated_at = now()
  where id = p_notification_id and recipient_id = auth.uid();
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.notifications
  set is_read = true, updated_at = now()
  where recipient_id = auth.uid() and is_read = false;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;

create or replace function public.get_unread_notifications_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer from public.notifications where recipient_id = auth.uid() and is_read = false;
$$;

grant execute on function public.get_unread_notifications_count() to authenticated;

notify pgrst, 'reload schema';
