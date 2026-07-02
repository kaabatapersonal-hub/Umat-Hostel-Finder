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
