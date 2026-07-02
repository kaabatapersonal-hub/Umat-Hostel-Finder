# Applying the Session 2 schema

The migrations in `supabase/migrations/` are the source of truth (in order:
`extensions_and_helpers` → `profiles` → `hostels` → `submissions` → `reviews`
→ `saved_hostels` → `roommate_v2` → `storage_buckets`). This doc is a
convenience for applying them by hand via the Supabase SQL editor and running
the Definition-of-Done checklist from the session brief.

If you'd rather use the CLI: `npx supabase link --project-ref ebdmqflfnsqpaujhezgw`
then `npx supabase db push` (needs a Supabase personal access token and your
database password).

## 1. Apply the schema

Open the [SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
for your project and paste + run the full script below (or run each file in
`supabase/migrations/` individually, in filename order — they're numbered).

```sql
-- ============================================================
-- 20260702182846_extensions_and_helpers.sql
-- ============================================================
-- Extensions & shared helper functions used by every later migration.

create extension if not exists pgcrypto;

-- Auto-touch updated_at on any UPDATE. Attached per-table in later migrations.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- is_admin() lives in the profiles migration (20260702182852_profiles.sql)
-- since it queries public.profiles, which doesn't exist yet at this point.


-- ============================================================
-- 20260702182852_profiles.sql
-- ============================================================
-- profiles: public mirror of auth.users, one row per user.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Reads the caller's role from profiles. SECURITY DEFINER + fixed search_path
-- so it can be called from RLS policies (including this table's own) without
-- triggering recursive RLS evaluation.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- A student must never be able to grant themselves admin. RLS can't restrict
-- individual columns on a row-level UPDATE, so enforce it in a trigger: any
-- role change is silently reverted unless the caller is already an admin.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Creates the matching profiles row whenever a new auth.users row appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());


-- ============================================================
-- 20260702182858_hostels.sql
-- ============================================================
-- hostels: the core entity. Live, approved listings only — pending student
-- submissions live in `submissions` and never touch this table directly.

create table public.hostels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  price numeric not null,
  location text not null,
  distance_text text,
  latitude double precision,
  longitude double precision,
  description text,
  images text[] not null default '{}',
  room_images jsonb not null default '{}',
  facilities text[] not null default '{}',
  room_type text check (room_type in ('single', 'double', 'triple', 'quad')),
  contact text not null,
  whatsapp_group text,
  tags text[] not null default '{}',
  availability text not null default 'available'
    check (availability in ('available', 'filling', 'full')),
  availability_updated_at timestamptz not null default now(),
  featured boolean not null default false,
  featured_until timestamptz,
  is_paid boolean not null default false,
  rating_avg numeric not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.hostels
  for each row execute function public.set_updated_at();

-- Bump availability_updated_at whenever availability actually changes, so the
-- app never has to remember to do it manually.
create or replace function public.touch_availability_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.availability is distinct from old.availability then
    new.availability_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger touch_availability_updated_at
  before update on public.hostels
  for each row execute function public.touch_availability_updated_at();

-- Indexes: every FK, every filtered/sorted column, plus the composite the
-- default feed sort (featured first, newest first) actually runs.
create index hostels_owner_id_idx on public.hostels (owner_id);
create index hostels_featured_idx on public.hostels (featured);
create index hostels_location_idx on public.hostels (location);
create index hostels_price_idx on public.hostels (price);
create index hostels_availability_idx on public.hostels (availability);
create index hostels_created_at_idx on public.hostels (created_at desc);
create index hostels_featured_created_at_idx on public.hostels (featured, created_at desc);

-- RLS
alter table public.hostels enable row level security;

create policy "hostels_select_all"
  on public.hostels for select
  using (true);

create policy "hostels_insert_admin"
  on public.hostels for insert
  with check (public.is_admin());

create policy "hostels_update_owner_or_admin"
  on public.hostels for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy "hostels_delete_admin"
  on public.hostels for delete
  using (public.is_admin());


-- ============================================================
-- 20260702182905_submissions.sql
-- ============================================================
-- submissions: student-submitted hostel data pending admin review. Kept
-- separate from `hostels` so pending/rejected data never mixes with live
-- listings.

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  price numeric,
  location text,
  distance_text text,
  description text,
  contact text,
  latitude double precision,
  longitude double precision,
  images text[] not null default '{}',
  room_images jsonb not null default '{}',
  facilities text[] not null default '{}',
  tags text[] not null default '{}',
  room_type text check (room_type in ('single', 'double', 'triple', 'quad')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

create index submissions_status_idx on public.submissions (status);
create index submissions_submitted_by_idx on public.submissions (submitted_by);

-- RLS
alter table public.submissions enable row level security;

create policy "submissions_insert_own"
  on public.submissions for insert
  with check (submitted_by = auth.uid());

create policy "submissions_select_own_or_admin"
  on public.submissions for select
  using (submitted_by = auth.uid() or public.is_admin());

create policy "submissions_update_admin"
  on public.submissions for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "submissions_delete_admin"
  on public.submissions for delete
  using (public.is_admin());


-- ============================================================
-- 20260702182911_reviews.sql
-- ============================================================
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


-- ============================================================
-- 20260702182916_saved_hostels.sql
-- ============================================================
-- saved_hostels: a user's bookmarked hostels. Caches a few display fields so
-- the Saved tab renders without joining back to hostels.

create table public.saved_hostels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  hostel_id uuid not null references public.hostels (id) on delete cascade,
  hostel_name text,
  hostel_price numeric,
  hostel_location text,
  hostel_image text,
  created_at timestamptz not null default now(),
  unique (user_id, hostel_id)
);

-- Indexes. The UNIQUE constraint above already indexes user_id as its
-- leading column; hostel_id needs its own index for "who saved this hostel".
create index saved_hostels_hostel_id_idx on public.saved_hostels (hostel_id);

-- RLS: a user only ever sees/manages their own saves.
alter table public.saved_hostels enable row level security;

create policy "saved_hostels_all_own"
  on public.saved_hostels for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ============================================================
-- 20260702182922_roommate_v2.sql
-- ============================================================
-- V2 tables (Roommate Matcher). Created now so V2 needs no migration; RLS is
-- enabled with no policies (deny-all to anon/authenticated) until the V2
-- session defines real access rules. Only the service role can touch these
-- until then.

create table public.roommate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  whatsapp text not null,
  budget text check (budget in ('under_1000', '1000_2000', '2000_3000', '3000_above')),
  room_type text check (room_type in ('single', 'double', 'triple', 'quad')),
  preferred_location text,
  sleep_time text check (sleep_time in ('early_bird', 'average', 'night_owl')),
  cleanliness text check (cleanliness in ('very_tidy', 'average', 'relaxed')),
  study_habits text check (study_habits in ('quiet', 'moderate', 'social')),
  gender text check (gender in ('male', 'female')),
  about text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.roommate_profiles
  for each row execute function public.set_updated_at();

create index roommate_profiles_user_id_idx on public.roommate_profiles (user_id);
create index roommate_profiles_is_active_idx on public.roommate_profiles (is_active);

alter table public.roommate_profiles enable row level security;

create table public.roommate_requests (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references public.roommate_profiles (id) on delete cascade,
  to_profile_id uuid not null references public.roommate_profiles (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  from_name text not null,
  to_name text not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  from_whatsapp text, -- revealed to `to_user` only once status = 'accepted' (app-enforced in V2)
  to_whatsapp text, -- revealed to `from_user` only once status = 'accepted' (app-enforced in V2)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.roommate_requests
  for each row execute function public.set_updated_at();

create index roommate_requests_from_profile_id_idx on public.roommate_requests (from_profile_id);
create index roommate_requests_to_profile_id_idx on public.roommate_requests (to_profile_id);
create index roommate_requests_from_user_id_idx on public.roommate_requests (from_user_id);
create index roommate_requests_to_user_id_idx on public.roommate_requests (to_user_id);
create index roommate_requests_status_idx on public.roommate_requests (status);

alter table public.roommate_requests enable row level security;


-- ============================================================
-- 20260702182927_storage_buckets.sql
-- ============================================================
-- Storage buckets for hostel photos. Public read (images must load without
-- auth on the feed); only authenticated users can write. Path-scoping to
-- "only your own hostel/submission" is deferred to Session 5.

insert into storage.buckets (id, name, public)
values
  ('hostel-images', 'hostel-images', true),
  ('room-images', 'room-images', true)
on conflict (id) do nothing;

create policy "hostel_images_public_read"
  on storage.objects for select
  using (bucket_id = 'hostel-images');

create policy "hostel_images_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'hostel-images' and auth.role() = 'authenticated');

create policy "hostel_images_owner_update"
  on storage.objects for update
  using (bucket_id = 'hostel-images' and owner = auth.uid())
  with check (bucket_id = 'hostel-images' and owner = auth.uid());

create policy "hostel_images_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'hostel-images' and owner = auth.uid());

create policy "room_images_public_read"
  on storage.objects for select
  using (bucket_id = 'room-images');

create policy "room_images_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'room-images' and auth.role() = 'authenticated');

create policy "room_images_owner_update"
  on storage.objects for update
  using (bucket_id = 'room-images' and owner = auth.uid())
  with check (bucket_id = 'room-images' and owner = auth.uid());

create policy "room_images_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'room-images' and owner = auth.uid());
```

## 2. Seed one test hostel (runs as `postgres`, bypasses RLS)

```sql
insert into public.hostels (name, price, location, distance_text, contact, availability, featured)
values ('Green Valley Hostel', 2200, 'North Campus', '12 mins walk', '+233200000000', 'available', true)
returning id;
```

Keep the returned `id` — you'll need it for the review test below.

## 3. Prove the rating trigger

You need two `profiles` rows to attach reviews to (one per `author_id`, since
`reviews` has `UNIQUE (hostel_id, author_id)`). Easiest path: sign up two test
users through Supabase Auth (dashboard → Authentication → Add user, or via
the app once Session 6 auth exists) — each gets a `profiles` row
automatically via the `handle_new_user` trigger. Then, using the hostel id
from step 2 and the two profile ids:

```sql
insert into public.reviews (hostel_id, author_id, rating, comment)
values ('<hostel-id>', '<profile-id-1>', 5, 'Great place, quiet and close to campus.');

insert into public.reviews (hostel_id, author_id, rating, comment)
values ('<hostel-id>', '<profile-id-2>', 3, 'Decent but water pressure is weak.');

select name, rating_avg, rating_count from public.hostels where id = '<hostel-id>';
-- expect rating_avg = 4.00, rating_count = 2
```

## 4. Make yourself admin

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## 5. Run the automated RLS checks

```sh
node scripts/verify-schema.mjs
```

This uses only the **anon key** (same as an unauthenticated browser) to
confirm: public SELECT on `hostels` works, anon INSERT/UPDATE on `hostels` is
denied, anon INSERT on `reviews` is denied, and `saved_hostels` returns
nothing to anon.

## 6. Regenerate types once applied (recommended)

`src/lib/supabase/database.types.ts` was hand-written to match the
migrations exactly. Once the schema is live, regenerate it from Supabase
directly and diff against the hand-written version to catch any drift:

```sh
npx supabase login
npx supabase gen types typescript --project-id ebdmqflfnsqpaujhezgw --schema public > src/lib/supabase/database.types.ts
```
