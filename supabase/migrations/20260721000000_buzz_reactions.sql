-- Session 21 Part 2: Buzz emoji reactions
--
-- A fixed set of 5 emojis (not an open picker) -- keeps this fast to
-- render and impossible to abuse with arbitrary unicode/spam text, and
-- matches the brief's "same concept as UMaTVibes stickers but simpler."
-- Counts are denormalized onto buzz_posts.reaction_counts (a jsonb map,
-- e.g. {"fire":12,"thumbsup":5}), trigger-maintained exactly like
-- buzz_posts.reply_count already is -- the feed reads one cheap column,
-- never aggregates buzz_reactions per row it renders.
--
-- Every statement is safely re-runnable, same standing requirement as
-- every migration in this project.

alter table public.buzz_posts add column if not exists reaction_counts jsonb not null default '{}';

create table if not exists public.buzz_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.buzz_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '👍', '😂', '💯', '👀')),
  created_at timestamptz not null default now(),
  -- One of each emoji per user per post -- a user can react with several
  -- different emojis on the same post, but can't stack the same one twice
  -- (that's what the toggle-off behavior is for).
  unique (post_id, author_id, emoji)
);

create index if not exists buzz_reactions_post_id_idx on public.buzz_reactions (post_id);
create index if not exists buzz_reactions_author_id_idx on public.buzz_reactions (author_id);

-- Recompute-from-source-of-truth, identical shape to
-- recalculate_post_reply_count -- never incremented/decremented in place.
create or replace function public.recalculate_post_reaction_counts(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.buzz_posts p
  set reaction_counts = coalesce(
    (
      select jsonb_object_agg(emoji, cnt)
      from (
        select emoji, count(*) as cnt
        from public.buzz_reactions
        where post_id = p_post_id
        group by emoji
      ) counts
    ),
    '{}'::jsonb
  )
  where p.id = p_post_id;
end;
$$;

create or replace function public.handle_buzz_reaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_post_reaction_counts(old.post_id);
    return old;
  end if;

  perform public.recalculate_post_reaction_counts(new.post_id);
  return new;
end;
$$;

-- No UPDATE case needed (unlike buzz_replies' equivalent trigger) --
-- a reaction is only ever inserted or deleted, never edited in place;
-- toggling a reaction off-then-on-with-a-different-emoji is two separate
-- insert/delete calls, not an update.
drop trigger if exists buzz_reactions_update_post_counts on public.buzz_reactions;
create trigger buzz_reactions_update_post_counts
  after insert or delete on public.buzz_reactions
  for each row execute function public.handle_buzz_reaction_change();

-- Bulk-toggles a single (post, emoji) pair for the caller: adds the
-- reaction if it doesn't exist yet, removes it if it does. Returns the
-- new state (true = now reacted, false = now removed) so the client can
-- reconcile its optimistic UI with a single round trip instead of a
-- separate "check, then insert-or-delete" pair of requests.
-- security invoker, not definer -- both branches only ever touch rows
-- the caller's own RLS grants already let them touch (author_id =
-- auth.uid()); this is a convenience/atomicity wrapper, not a privilege
-- bridge, same reasoning as set_leaving_campus_mode.
create or replace function public.toggle_buzz_reaction(p_post_id uuid, p_emoji text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  if exists (
    select 1 from public.buzz_reactions
    where post_id = p_post_id and author_id = auth.uid() and emoji = p_emoji
  ) then
    delete from public.buzz_reactions
    where post_id = p_post_id and author_id = auth.uid() and emoji = p_emoji;
    return false;
  else
    insert into public.buzz_reactions (post_id, author_id, emoji)
    values (p_post_id, auth.uid(), p_emoji);
    return true;
  end if;
end;
$$;

grant execute on function public.toggle_buzz_reaction(uuid, text) to authenticated;

-- RLS
alter table public.buzz_reactions enable row level security;

drop policy if exists "buzz_reactions_select_all" on public.buzz_reactions;
create policy "buzz_reactions_select_all"
  on public.buzz_reactions for select
  using (true);

-- Suspended accounts (Session 16) can't create reactions either -- same
-- content-creation abuse surface as every other Buzz insert policy.
-- Removing a reaction is not gated the same way (same posture as
-- reviews/buzz delete-own -- cleaning up your own past action isn't the
-- abuse pattern suspension exists for).
drop policy if exists "buzz_reactions_insert_own" on public.buzz_reactions;
create policy "buzz_reactions_insert_own"
  on public.buzz_reactions for insert
  with check (author_id = auth.uid() and not public.is_suspended());

drop policy if exists "buzz_reactions_delete_own" on public.buzz_reactions;
create policy "buzz_reactions_delete_own"
  on public.buzz_reactions for delete
  using (author_id = auth.uid());

notify pgrst, 'reload schema';
