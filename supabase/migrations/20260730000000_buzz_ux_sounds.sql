-- Buzz Session B: feed-only UX overhaul (double-tap like, save-as-image,
-- reply bottom sheet) + app-wide sounds. Sounds and the reply sheet are
-- entirely client-side -- nothing to migrate for those. The one schema
-- change this session actually needs is removing bookmarks: the new
-- action row layout has no bookmark icon at all ("save" now means
-- "download this post as an image", not "private save"), so the
-- buzz_bookmarks table/column from Session A.5 is being removed rather
-- than left stranded with no UI pointing at it. Likes, Hot/New, reports,
-- rate limiting, and view counts (all from Session A / A.5) are untouched.

-- =========================================================================
-- 1. Remove bookmarks
-- =========================================================================

-- CASCADE drops the table's own trigger, indexes, and RLS policies with
-- it -- no separate DROP TRIGGER needed (and no idempotency landmine from
-- one: a previous Buzz v2 migration once broke on `DROP TRIGGER ... ON
-- <table>` after that same table had already been dropped by an earlier
-- run of the same file; CASCADE on the table drop itself sidesteps that
-- entirely since there's nothing left to separately reference).
drop table if exists public.buzz_bookmarks cascade;

drop function if exists public.handle_buzz_bookmark_change();
drop function if exists public.recalculate_post_bookmark_count(uuid);

alter table public.buzz_posts drop column if exists bookmark_count;

-- =========================================================================
-- 2. get_hot_buzz_posts must drop bookmark_count from its return columns
-- =========================================================================
-- Same reasoning as when this function gained bookmark_count last
-- session: Postgres won't let CREATE OR REPLACE change a function's
-- return type, so the old signature has to be dropped first.
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
      p.reply_count, p.like_count, p.view_count, p.created_at,
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
