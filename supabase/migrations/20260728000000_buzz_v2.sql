-- Buzz v2: single like replaces 5-emoji reactions, Hot/New feed sorting,
-- a report system, and server-side post rate limiting.

-- =========================================================================
-- 1. Replace buzz_reactions (5-emoji) with buzz_likes (single like)
-- =========================================================================

-- `drop trigger if exists X on public.buzz_reactions` would itself error
-- with "relation does not exist" on a second run, once the table it
-- names is already gone -- IF EXISTS only guards the trigger, not the
-- relation the DROP TRIGGER statement names, so the table has to be
-- checked for directly first. Caught by literally re-running this
-- migration a second time, which every migration in this project must
-- tolerate.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'buzz_reactions') then
    execute 'drop trigger if exists buzz_reactions_update_post_counts on public.buzz_reactions';
  end if;
end $$;
drop function if exists public.handle_buzz_reaction_change();
drop function if exists public.recalculate_post_reaction_counts(uuid);
drop function if exists public.toggle_buzz_reaction(uuid, text);
drop table if exists public.buzz_reactions;
alter table public.buzz_posts drop column if exists reaction_counts;

alter table public.buzz_posts add column if not exists like_count integer not null default 0;

create table if not exists public.buzz_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.buzz_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists buzz_likes_post_id_idx on public.buzz_likes (post_id);
create index if not exists buzz_likes_user_id_idx on public.buzz_likes (user_id);

-- Recompute-from-source-of-truth, identical shape to
-- recalculate_post_reply_count/recalculate_post_reaction_counts before it --
-- never incremented/decremented in place.
create or replace function public.recalculate_post_like_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.buzz_posts p
  set like_count = (select count(*) from public.buzz_likes where post_id = p_post_id)
  where p.id = p_post_id;
end;
$$;

create or replace function public.handle_buzz_like_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_post_like_count(old.post_id);
    return old;
  end if;

  perform public.recalculate_post_like_count(new.post_id);
  return new;
end;
$$;

-- No UPDATE case, same reasoning as buzz_reactions before it -- a like is
-- only ever inserted or deleted, never edited in place.
drop trigger if exists buzz_likes_update_post_count on public.buzz_likes;
create trigger buzz_likes_update_post_count
  after insert or delete on public.buzz_likes
  for each row execute function public.handle_buzz_like_change();

alter table public.buzz_likes enable row level security;

drop policy if exists "buzz_likes_select_all" on public.buzz_likes;
create policy "buzz_likes_select_all"
  on public.buzz_likes for select
  using (true);

-- Same content-creation abuse surface as every other Buzz insert policy --
-- suspended accounts can't like either.
drop policy if exists "buzz_likes_insert_own" on public.buzz_likes;
create policy "buzz_likes_insert_own"
  on public.buzz_likes for insert
  with check (user_id = auth.uid() and not public.is_suspended());

-- Unlike the old reactions' delete policy (identical shape, kept for
-- consistency): removing your own like is never suspend-gated -- cleaning
-- up your own past action isn't the abuse pattern suspension exists for.
drop policy if exists "buzz_likes_delete_own" on public.buzz_likes;
create policy "buzz_likes_delete_own"
  on public.buzz_likes for delete
  using (user_id = auth.uid());

-- =========================================================================
-- 2. Hot feed ranking
-- =========================================================================
--
-- A generated column can't work here -- `now()` isn't an immutable
-- expression, which Postgres requires for GENERATED ALWAYS AS. An RPC that
-- computes the score inline in its ORDER BY is the only viable approach.
--
-- Tiebreak choice beyond the brief's own formula: a brand-new, zero-like
-- post scores exactly 0 (like_count / anything = 0), tied with every other
-- post that's never been liked -- a majority of the feed, in practice. A
-- pure `id desc` tiebreak would order those ties by gen_random_uuid(),
-- which is effectively random, not chronological. `created_at desc` as the
-- primary tiebreak (falling back to `id desc` only for the vanishingly
-- rare exact-same-timestamp case) makes Hot degrade to "newest first"
-- among ties instead of a random shuffle -- and, usefully, means a just-
-- posted 0-like post's rank is stable and predictable enough for the
-- client to optimistically splice it at the top of the Hot cache the same
-- way it already does for New (see use-create-buzz-post.ts).
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
      p.reply_count, p.like_count, p.created_at,
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

-- Public read, same as the feed itself (buzz_posts_select_all is
-- using(true)) -- Buzz is browsable signed out, Hot is just another sort
-- of the same public data.
grant execute on function public.get_hot_buzz_posts(double precision, timestamptz, uuid, int) to anon, authenticated;

-- =========================================================================
-- 3. Report system
-- =========================================================================

create table if not exists public.buzz_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  -- set null, not cascade -- a report is a moderation record, and
  -- resolve_buzz_report's whole 'delete' action is "remove the content
  -- but keep the record that it was reported and what was done about
  -- it." Cascading here would have deleted the report itself the moment
  -- its target post/reply was deleted, wiping the audit trail before the
  -- RPC's own status update even ran (caught by the live audit: the
  -- report vanished along with the post instead of ending up 'reviewed').
  post_id uuid references public.buzz_posts (id) on delete set null,
  reply_id uuid references public.buzz_replies (id) on delete set null,
  reason text not null check (reason in ('inappropriate', 'spam', 'harassment', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Only rejects "both set" -- NOT "exactly one required forever," since
  -- on delete set null (above) means a resolved-and-deleted report
  -- legitimately ends up with both columns null, and that must stay a
  -- valid, permanent state for the row, not something the next stray
  -- UPDATE could violate.
  constraint buzz_reports_not_both_targets check (not (post_id is not null and reply_id is not null)),
  -- Postgres never treats two NULLs as equal for a unique constraint, so
  -- each of these only actually constrains the report type it names: a
  -- reply-report (post_id null on every row) never collides with another
  -- reply-report on the (reporter_id, post_id) constraint, and vice versa.
  -- Net effect: one report per user per post, and separately, one report
  -- per user per reply -- exactly what's wanted, no partial index needed.
  unique (reporter_id, post_id),
  unique (reporter_id, reply_id)
);

-- Repairs a live table that was already created by an earlier run of
-- this same migration before this fix, back when post_id/reply_id were
-- still `on delete cascade` -- a no-op on a table that was never created
-- with the old (wrong) definition in the first place.
alter table public.buzz_reports drop constraint if exists buzz_reports_post_id_fkey;
alter table public.buzz_reports add constraint buzz_reports_post_id_fkey
  foreign key (post_id) references public.buzz_posts (id) on delete set null;

alter table public.buzz_reports drop constraint if exists buzz_reports_reply_id_fkey;
alter table public.buzz_reports add constraint buzz_reports_reply_id_fkey
  foreign key (reply_id) references public.buzz_replies (id) on delete set null;

alter table public.buzz_reports drop constraint if exists buzz_reports_exactly_one_target;
alter table public.buzz_reports drop constraint if exists buzz_reports_not_both_targets;
alter table public.buzz_reports add constraint buzz_reports_not_both_targets
  check (not (post_id is not null and reply_id is not null));

create index if not exists buzz_reports_status_idx on public.buzz_reports (status);
create index if not exists buzz_reports_post_id_idx on public.buzz_reports (post_id);
create index if not exists buzz_reports_reply_id_idx on public.buzz_reports (reply_id);

alter table public.buzz_reports enable row level security;

-- Widened from the brief's literal "admins only" -- a reporter needs to
-- read their *own* rows too, otherwise "already reported this, show
-- disabled/Reported state" (explicitly asked for below) has no way to
-- work under RLS. Same "own-or-moderator" shape every other flag/report
-- table in this app already uses (reviews' reported flag, saved_hostels,
-- submissions) -- not a new pattern, just applying the existing one here.
drop policy if exists "buzz_reports_select_own_or_moderator" on public.buzz_reports;
create policy "buzz_reports_select_own_or_moderator"
  on public.buzz_reports for select
  using (reporter_id = auth.uid() or public.has_permission('moderate_buzz'));

-- "At least one of post_id/reply_id" lives here, in the INSERT policy's
-- own WITH CHECK, not as a table-level CHECK constraint -- a CHECK runs
-- against every row modification regardless of source, including the
-- FK's own ON DELETE SET NULL cascade, and that cascade needs to be
-- allowed to leave a resolved report with *both* columns null (see
-- buzz_reports_not_both_targets's own comment). RLS's WITH CHECK, unlike
-- a CHECK constraint, only ever runs for an actual INSERT/UPDATE
-- statement executed through a role -- never for an internal FK action --
-- so it's the right place to require "a real, freshly-filed report must
-- name something" without also blocking the cascade that later clears it.
drop policy if exists "buzz_reports_insert_own" on public.buzz_reports;
create policy "buzz_reports_insert_own"
  on public.buzz_reports for insert
  with check (
    reporter_id = auth.uid()
    and not public.is_suspended()
    and (post_id is not null or reply_id is not null)
  );

-- No update/delete policy for anyone, including moderators -- the only
-- legitimate write path is resolve_buzz_report below, which needs to
-- change buzz_reports.status *and* possibly delete the reported content
-- atomically. Exposing a raw PATCH surface on top of that would just be a
-- second, unaudited way to reach the same state.

-- Resolves a pending report: 'dismiss' just closes it out, 'delete'
-- removes the reported post/reply (via the exact same tables' own
-- existing RLS-equivalent authority -- this function's own
-- has_permission check *is* that authority here, running as security
-- definer) and closes the report as 'reviewed'. Atomic: a report can never
-- end up half-resolved (content gone but report still 'pending', or vice
-- versa) the way two separate client calls could leave it under a partial
-- failure.
create or replace function public.resolve_buzz_report(p_report_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.buzz_reports%rowtype;
begin
  if not public.has_permission('moderate_buzz') then
    raise exception 'Not authorized';
  end if;

  if p_action not in ('dismiss', 'delete') then
    raise exception 'Invalid action: %', p_action;
  end if;

  select * into v_report from public.buzz_reports where id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;

  if p_action = 'delete' then
    if v_report.post_id is not null then
      delete from public.buzz_posts where id = v_report.post_id;
    else
      delete from public.buzz_replies where id = v_report.reply_id;
    end if;
  end if;

  update public.buzz_reports
  set status = case when p_action = 'delete' then 'reviewed' else 'dismissed' end,
      reviewed_by = auth.uid()
  where id = p_report_id;
end;
$$;

grant execute on function public.resolve_buzz_report(uuid, text) to authenticated;

-- =========================================================================
-- 4. Server-side rate limiting (posts only, not replies)
-- =========================================================================

create or replace function public.enforce_buzz_post_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_hour integer;
  v_last_day integer;
begin
  select count(*) into v_last_hour
  from public.buzz_posts
  where author_id = new.author_id and created_at >= now() - interval '1 hour';

  if v_last_hour >= 10 then
    raise exception 'Rate limit: too many posts in the last hour';
  end if;

  select count(*) into v_last_day
  from public.buzz_posts
  where author_id = new.author_id and created_at >= now() - interval '24 hours';

  if v_last_day >= 30 then
    raise exception 'Rate limit: too many posts in the last 24 hours';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_buzz_post_rate_limit on public.buzz_posts;
create trigger enforce_buzz_post_rate_limit
  before insert on public.buzz_posts
  for each row execute function public.enforce_buzz_post_rate_limit();

notify pgrst, 'reload schema';
