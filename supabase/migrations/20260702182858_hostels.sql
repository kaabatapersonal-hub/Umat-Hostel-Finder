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
