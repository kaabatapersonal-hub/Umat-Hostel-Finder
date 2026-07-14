-- Admin self-service toggle for the marketplace_enabled flag, replacing
-- the "flip it via a direct SQL UPDATE" workflow from Session 19 with a
-- real admin-panel button. A dedicated, single-purpose RPC (not a generic
-- "toggle any config key by name") -- there's exactly one flag that needs
-- this today, and a generic version would need to validate the key
-- exists and is actually boolean-typed for no real benefit yet.
create or replace function public.toggle_marketplace()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_value jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.app_config
  set value = case when value = 'true'::jsonb then 'false'::jsonb else 'true'::jsonb end
  where key = 'marketplace_enabled'
  returning value into v_new_value;

  if not found then
    raise exception 'marketplace_enabled config row not found';
  end if;

  return v_new_value = 'true'::jsonb;
end;
$$;

grant execute on function public.toggle_marketplace() to authenticated;
