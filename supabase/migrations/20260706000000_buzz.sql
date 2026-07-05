-- Session 17: Buzz (hostel community board) -- posts + replies, admin
-- moderation. See SECURITY.md for the full reasoning behind the choices
-- below; the short version of each:
--
-- author_name is a denormalized column on both tables, NOT in the
-- session brief's literal schema -- it has to be. Session 15 tightened
-- `profiles` SELECT to `id = auth.uid() or is_admin()`, so a public/anon
-- reader of Buzz (which must be publicly readable, per the brief) cannot
-- join to another user's profiles row to get their name. reviews solved
-- this exact problem the same way (reviewer_name, default_reviewer_name
-- trigger) -- this migration reuses that precedent rather than reopening
-- the profiles lockdown or inventing a new public name-lookup RPC.
--
-- No new RPCs are needed at all: reads are public (`using (true)`),
-- writes are author-or-admin RLS same as reviews, and pin/delete are
-- both plain updates/deletes an admin's existing RLS grant already
-- covers -- there's no privilege gap here the way there was for
-- profiles.role in Session 16.

create table public.buzz_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text,
  content text not null check (char_length(content) >= 5 and char_length(content) <= 500),
  is_admin_post boolean not null default false,
  is_pinned boolean not null default false,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buzz_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.buzz_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text,
  content text not null check (char_length(content) >= 2 and char_length(content) <= 300),
  created_at timestamptz not null default now()
);

create index buzz_posts_created_at_idx on public.buzz_posts (created_at desc);
create index buzz_posts_is_pinned_idx on public.buzz_posts (is_pinned);
create index buzz_posts_author_id_idx on public.buzz_posts (author_id);
create index buzz_replies_post_id_idx on public.buzz_replies (post_id);
create index buzz_replies_author_id_idx on public.buzz_replies (author_id);

create trigger set_updated_at
  before update on public.buzz_posts
  for each row execute function public.set_updated_at();

-- One trigger, three jobs, all on buzz_posts writes:
--  1. author_name and is_admin_post are never client-settable -- always
--     recomputed from the CURRENT profiles row of new.author_id, on
--     both insert and update. (Recompute-from-truth, not "if null" --
--     there's no legitimate reason for a client to ever supply either.)
--  2. author_id/reply_count are pinned to their old values on update --
--     an author editing their post's content must never be able to
--     reassign authorship or forge the trigger-maintained reply count.
--  3. is_pinned can only change if the caller is admin -- RLS's own
--     `author_id = auth.uid() or is_admin()` would otherwise let an
--     author flip is_pinned on their own row, the same column-vs-row
--     gap Session 15 hit with reviews' is_resident/reported.
create or replace function public.protect_buzz_post_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.author_id := old.author_id;
    new.reply_count := old.reply_count;

    if new.is_pinned is distinct from old.is_pinned and not public.is_admin() then
      new.is_pinned := old.is_pinned;
    end if;
  end if;

  select full_name into new.author_name from public.profiles where id = new.author_id;
  new.is_admin_post := exists (
    select 1 from public.profiles where id = new.author_id and role = 'admin'
  );

  return new;
end;
$$;

create trigger protect_buzz_post_writes
  before insert or update on public.buzz_posts
  for each row execute function public.protect_buzz_post_writes();

-- Caps pinned posts at 3: whenever a post is newly pinned, keep only the
-- 3 most-recently-created pinned posts, unpinning any older ones. Runs
-- after the row commits (needs to touch *other* rows, which a BEFORE
-- trigger on this row can't do).
create or replace function public.enforce_buzz_pin_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_pinned and not old.is_pinned then
    update public.buzz_posts
    set is_pinned = false
    where is_pinned = true
      and id not in (
        select id from public.buzz_posts where is_pinned = true order by created_at desc limit 3
      );
  end if;
  return new;
end;
$$;

create trigger buzz_posts_enforce_pin_cap
  after update on public.buzz_posts
  for each row execute function public.enforce_buzz_pin_cap();

-- author_name on a reply: same recompute-from-truth as posts, just
-- simpler (no admin badge, no is_pinned, nothing to protect on update
-- since replies aren't reassignable and there's no reply edit UI yet).
create or replace function public.set_buzz_reply_author_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select full_name into new.author_name from public.profiles where id = new.author_id;
  return new;
end;
$$;

create trigger set_buzz_reply_author_name
  before insert on public.buzz_replies
  for each row execute function public.set_buzz_reply_author_name();

-- reply_count maintenance -- identical shape to reviews' rating trigger
-- (recompute the aggregate from source of truth, never increment in
-- place), covering the (currently impossible, since there's no reply-move
-- UI) case of a reply's post_id changing on UPDATE for free.
create or replace function public.recalculate_post_reply_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.buzz_posts p
  set reply_count = (select count(*) from public.buzz_replies where post_id = p_post_id)
  where p.id = p_post_id;
end;
$$;

create or replace function public.handle_buzz_reply_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_post_reply_count(old.post_id);
    return old;
  end if;

  perform public.recalculate_post_reply_count(new.post_id);

  if tg_op = 'UPDATE' and old.post_id is distinct from new.post_id then
    perform public.recalculate_post_reply_count(old.post_id);
  end if;

  return new;
end;
$$;

create trigger buzz_replies_update_post_reply_count
  after insert or update or delete on public.buzz_replies
  for each row execute function public.handle_buzz_reply_change();

-- RLS
alter table public.buzz_posts enable row level security;
alter table public.buzz_replies enable row level security;

create policy "buzz_posts_select_all"
  on public.buzz_posts for select
  using (true);

-- Suspended accounts (Session 16) can't post here either -- same content-
-- creation abuse surface as reviews/submissions.
create policy "buzz_posts_insert_own"
  on public.buzz_posts for insert
  with check (author_id = auth.uid() and not public.is_suspended());

create policy "buzz_posts_update_author_or_admin"
  on public.buzz_posts for update
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

create policy "buzz_posts_delete_author_or_admin"
  on public.buzz_posts for delete
  using (author_id = auth.uid() or public.is_admin());

create policy "buzz_replies_select_all"
  on public.buzz_replies for select
  using (true);

create policy "buzz_replies_insert_own"
  on public.buzz_replies for insert
  with check (author_id = auth.uid() and not public.is_suspended());

create policy "buzz_replies_update_own"
  on public.buzz_replies for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "buzz_replies_delete_author_or_admin"
  on public.buzz_replies for delete
  using (author_id = auth.uid() or public.is_admin());
