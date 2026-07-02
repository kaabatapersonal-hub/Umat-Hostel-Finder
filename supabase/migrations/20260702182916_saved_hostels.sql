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
