-- Buzz Session A.5: bookmarks (private saves), share (client-only, no
-- schema needed), and view counts. Additive alongside Session A (likes,
-- Hot/New, reports, rate limiting) -- nothing from that migration is
-- touched here.

-- =========================================================================
-- 1. Bookmarks
-- =========================================================================

alter table public.buzz_posts add column if not exists bookmark_count integer not null default 0;

create table if not exists public.buzz_bookmarks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.buzz_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists buzz_bookmarks_post_id_idx on public.buzz_bookmarks (post_id);
-- Powers "my saved posts, most recent first" (Profile's Saved Posts tab)
-- as a single indexed lookup rather than a sort over every row.
create index if not exists buzz_bookmarks_user_id_created_at_idx on public.buzz_bookmarks (user_id, created_at desc);

-- Recompute-from-source-of-truth, identical shape to the likes/reply-count
-- triggers before it -- never incremented/decremented in place.
create or replace function public.recalculate_post_bookmark_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.buzz_posts p
  set bookmark_count = (select count(*) from public.buzz_bookmarks where post_id = p_post_id)
  where p.id = p_post_id;
end;
$$;

create or replace function public.handle_buzz_bookmark_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_post_bookmark_count(old.post_id);
    return old;
  end if;

  perform public.recalculate_post_bookmark_count(new.post_id);
  return new;
end;
$$;

-- No UPDATE case, same reasoning as buzz_likes -- a bookmark is only ever
-- inserted or deleted, never edited in place.
drop trigger if exists buzz_bookmarks_update_post_count on public.buzz_bookmarks;
create trigger buzz_bookmarks_update_post_count
  after insert or delete on public.buzz_bookmarks
  for each row execute function public.handle_buzz_bookmark_change();

alter table public.buzz_bookmarks enable row level security;

-- Own-only read -- the *count* is public (bookmark_count lives on the
-- publicly-readable buzz_posts row, refreshed by this table's own
-- security-definer trigger regardless of who can SELECT this table), but
-- WHO bookmarked a post must not be independently discoverable, so this
-- policy does NOT use `using (true)` the way buzz_likes's does. Every
-- real caller (getMyBookmarkedPostIds, getSavedBuzzPosts) only ever
-- queries their own user_id anyway, so this costs no functionality.
drop policy if exists "buzz_bookmarks_select_all" on public.buzz_bookmarks;
drop policy if exists "buzz_bookmarks_select_own" on public.buzz_bookmarks;
create policy "buzz_bookmarks_select_own"
  on public.buzz_bookmarks for select
  using (user_id = auth.uid());

-- Same content-creation abuse surface as every other Buzz insert policy.
drop policy if exists "buzz_bookmarks_insert_own" on public.buzz_bookmarks;
create policy "buzz_bookmarks_insert_own"
  on public.buzz_bookmarks for insert
  with check (user_id = auth.uid() and not public.is_suspended());

-- Removing your own bookmark is never suspend-gated -- same posture as
-- unliking/removing your own reaction before it.
drop policy if exists "buzz_bookmarks_delete_own" on public.buzz_bookmarks;
create policy "buzz_bookmarks_delete_own"
  on public.buzz_bookmarks for delete
  using (user_id = auth.uid());

-- =========================================================================
-- 2. View counts
-- =========================================================================

alter table public.buzz_posts add column if not exists view_count integer not null default 0;

-- security definer + granted to anon: viewing is open to everyone, same
-- as reading the feed itself -- there's no per-viewer identity to check
-- (no views table, deliberately, per the brief -- "we don't need to know
-- WHO viewed"), so this just needs to exist and be callable, not gated.
create or replace function public.increment_buzz_view(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.buzz_posts set view_count = view_count + 1 where id = p_post_id;
end;
$$;

grant execute on function public.increment_buzz_view(uuid) to anon, authenticated;

-- =========================================================================
-- 3. get_hot_buzz_posts must also return the two new columns
-- =========================================================================
-- Every BuzzPost the client maps (feed, hot feed, pinned, single-post) now
-- requires bookmark_count/view_count, but Session A's get_hot_buzz_posts
-- has its own explicit RETURNS TABLE column list -- Postgres won't let
-- CREATE OR REPLACE change a function's return type, so the old signature
-- must be dropped before recreating it with the two columns added.
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
  bookmark_count integer,
  view_count integer,
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
      p.reply_count, p.like_count, p.bookmark_count, p.view_count, p.created_at,
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
