-- Session 8.5: an owner can propose changes to their live hostel, but
-- those changes only take effect once an admin approves them (Session 11
-- builds that review UI) -- this migration lays the buffer + the narrow
-- write path.
--
-- The key security property: an owner must NOT be able to write directly
-- to a live hostel's real columns. Session 2's hostels_update_owner_or_admin
-- policy let an owner update *any* column on their own row, which is
-- exactly what we don't want anymore -- so it's replaced with an
-- admin-only policy, and all owner edits now go through
-- submit_pending_edit(), a SECURITY DEFINER function that can only ever
-- touch pending_changes/has_pending_edit.

-- 1. The buffer. NULL pending_changes means "nothing proposed"; the live
-- columns are what every student sees regardless of what's sitting here.
alter table public.hostels add column pending_changes jsonb;
alter table public.hostels add column has_pending_edit boolean not null default false;

-- 2. Owners lose direct UPDATE access to hostels; admins keep full access.
drop policy "hostels_update_owner_or_admin" on public.hostels;

create policy "hostels_update_admin"
  on public.hostels for update
  using (public.is_admin())
  with check (public.is_admin());

-- 3. The only way an owner can affect their hostel row now: propose a
-- full replacement record into the buffer. pending_changes uses the same
-- snake_case keys as the hostels columns it will eventually replace, so
-- apply_pending_changes below can read it without a translation layer.
create or replace function public.submit_pending_edit(p_hostel_id uuid, p_pending_changes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.hostels where id = p_hostel_id and owner_id = auth.uid()
  ) then
    raise exception 'Not authorized to edit this hostel';
  end if;

  update public.hostels
  set pending_changes = p_pending_changes,
      has_pending_edit = true
  where id = p_hostel_id;
end;
$$;

grant execute on function public.submit_pending_edit(uuid, jsonb) to authenticated;

-- 4. Admin-only: merges the buffer into the live columns of the SAME row
-- (never a new hostel -- saved_hostels/reviews reference this id and must
-- keep working) and clears the buffer. room_types changing re-fires
-- maintain_hostel_price_range automatically, same as any other room_types
-- update. The full admin review UI lands in Session 11; this is the
-- mechanical "apply" step it will call.
create or replace function public.apply_pending_changes(p_hostel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select pending_changes into v_changes from public.hostels where id = p_hostel_id;
  if v_changes is null then
    raise exception 'No pending changes for this hostel';
  end if;

  update public.hostels
  set
    name = coalesce(v_changes ->> 'name', name),
    description = v_changes ->> 'description',
    location = coalesce(v_changes ->> 'location', location),
    distance_text = v_changes ->> 'distance_text',
    room_types = coalesce(v_changes -> 'room_types', room_types),
    images = coalesce(v_changes -> 'images', images),
    facilities = coalesce(
      (select array_agg(elem) from jsonb_array_elements_text(v_changes -> 'facilities') as elem),
      facilities
    ),
    contact = coalesce(v_changes ->> 'contact', contact),
    call_number = v_changes ->> 'call_number',
    latitude = (v_changes ->> 'latitude')::double precision,
    longitude = (v_changes ->> 'longitude')::double precision,
    tags = coalesce(
      (select array_agg(elem) from jsonb_array_elements_text(v_changes -> 'tags') as elem),
      tags
    ),
    pending_changes = null,
    has_pending_edit = false
  where id = p_hostel_id;
end;
$$;

grant execute on function public.apply_pending_changes(uuid) to authenticated;
