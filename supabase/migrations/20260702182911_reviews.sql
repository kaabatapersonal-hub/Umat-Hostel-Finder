-- reviews + the trigger that keeps hostels.rating_avg / rating_count cached
-- so the feed never runs AVG(rating) live.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references public.hostels (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) >= 15),
  reviewer_name text,
  is_resident boolean not null default false,
  reported boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hostel_id, author_id)
);

create trigger set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- reviewer_name defaults to the author's profile name if not supplied.
create or replace function public.default_reviewer_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reviewer_name is null then
    select full_name into new.reviewer_name from public.profiles where id = new.author_id;
  end if;
  return new;
end;
$$;

create trigger default_reviewer_name
  before insert on public.reviews
  for each row execute function public.default_reviewer_name();

-- Recomputes rating_avg / rating_count for one hostel from its live reviews.
create or replace function public.recalculate_hostel_rating(p_hostel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.hostels h
  set rating_avg = coalesce(r.avg_rating, 0),
      rating_count = coalesce(r.review_count, 0)
  from (
    select round(avg(rating)::numeric, 2) as avg_rating, count(*) as review_count
    from public.reviews
    where hostel_id = p_hostel_id
  ) r
  where h.id = p_hostel_id;
end;
$$;

-- Fires on every insert/update/delete; recalculates the affected hostel(s).
-- Covers the edge case of a review's hostel_id changing on UPDATE.
create or replace function public.handle_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_hostel_rating(old.hostel_id);
    return old;
  end if;

  perform public.recalculate_hostel_rating(new.hostel_id);

  if tg_op = 'UPDATE' and old.hostel_id is distinct from new.hostel_id then
    perform public.recalculate_hostel_rating(old.hostel_id);
  end if;

  return new;
end;
$$;

create trigger reviews_update_hostel_rating
  after insert or update or delete on public.reviews
  for each row execute function public.handle_review_change();

-- Indexes. The (hostel_id, author_id) UNIQUE constraint already indexes
-- hostel_id as its leading column; author_id needs its own index for
-- "my reviews" lookups.
create index reviews_author_id_idx on public.reviews (author_id);

-- RLS
alter table public.reviews enable row level security;

create policy "reviews_select_all"
  on public.reviews for select
  using (true);

create policy "reviews_insert_own"
  on public.reviews for insert
  with check (author_id = auth.uid());

create policy "reviews_update_author_or_admin"
  on public.reviews for update
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

create policy "reviews_delete_author_or_admin"
  on public.reviews for delete
  using (author_id = auth.uid() or public.is_admin());
