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
