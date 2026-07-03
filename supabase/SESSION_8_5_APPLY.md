# Applying Session 8.5

Two migrations this session.

## 1. Apply the migrations, in order

**`supabase/migrations/20260703170938_submissions_own_pending_rls.sql`** —
adds two additive RLS policies so a submitter can update/delete their own
submission while it's still `pending` (admin's existing full access is
untouched):

```sql
create policy "submissions_update_own_pending"
  on public.submissions for update
  using (submitted_by = auth.uid() and status = 'pending')
  with check (submitted_by = auth.uid() and status = 'pending');

create policy "submissions_delete_own_pending"
  on public.submissions for delete
  using (submitted_by = auth.uid() and status = 'pending');
```

**`supabase/migrations/20260703170944_hostel_pending_edit_flow.sql`** —
the owner edit-request buffer. This one **removes** an existing policy
(`hostels_update_owner_or_admin`) and replaces it with an admin-only one —
owners lose direct write access to hostels entirely and can only propose
changes through `submit_pending_edit()`:

```sql
alter table public.hostels add column pending_changes jsonb;
alter table public.hostels add column has_pending_edit boolean not null default false;

drop policy "hostels_update_owner_or_admin" on public.hostels;

create policy "hostels_update_admin"
  on public.hostels for update
  using (public.is_admin())
  with check (public.is_admin());

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
```

`apply_pending_changes` is admin-gated inside the function itself, not by
`grant`, so it's fine to grant `authenticated` broadly — a non-admin
calling it just gets "Admin only". The Session 11 admin queue UI will call
this to approve an edit request; there's no UI for it yet.

## 2. Verify

- **Room-type photos**: confirmed already optional in the existing Session
  8 code (no change needed) — a hostel with multiple room types and zero
  photos anywhere submits fine.
- **Home button**: tap "Submit Hostel" on the Home header while signed
  out — the auth sheet should rise; after signing in, it should land you
  on `/submit` with the real form.
- **Edit a pending submission**: Profile → My Submissions → Edit on a
  pending row — form should be pre-filled; Save should update the same
  row (still pending, same id — check `created_at` is unchanged, only
  `updated_at` moves).
- **Withdraw a pending submission**: Delete → confirm — row should be
  gone, and any uploaded images with it (check the `hostel-images`/
  `room-images` Storage browser).
- **Cross-user + status guard, direct API** (bypass the UI, like Session
  7's discipline):
  - Try to `UPDATE`/`DELETE` someone else's submission as yourself →
    blocked (0 rows affected).
  - Try to `UPDATE` your own submission's `status` to `'approved'` →
    blocked (the `WITH CHECK` requires the *new* row to still be
    `'pending'`).
  - Try to `UPDATE`/`DELETE` your own submission after it's no longer
    `'pending'` → blocked.
- **Edit an approved listing**: Profile → My Listings → Edit listing on a
  hostel you own → change something → submit. Confirm:
  - The **live** hostel (what students see) is unchanged.
  - `select pending_changes, has_pending_edit from public.hostels where id
    = '<id>';` shows your proposed changes and `has_pending_edit = true`.
  - Attempting a **direct** `PATCH` to `hostels` for a column like `name`
    (not via the RPC) fails outright — owners have no UPDATE policy left
    on `hostels` at all.
