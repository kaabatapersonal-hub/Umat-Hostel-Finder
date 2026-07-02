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
