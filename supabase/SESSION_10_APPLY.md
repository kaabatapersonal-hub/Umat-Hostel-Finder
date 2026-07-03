# Applying Session 10

One migration this session — everything else (admin's full INSERT/UPDATE/
DELETE on `hostels`, the `has_pending_edit` column) already exists from
Sessions 2 and 8.5.

## 1. Apply the migration

`supabase/migrations/20260703221745_saved_hostels_admin_select.sql` — the
dashboard's "Total saves" count needs to read every user's saves, but
`saved_hostels`' only policy (`saved_hostels_all_own`, Session 2) scopes
`SELECT` to the caller's own rows, even for an admin. This adds an
additive admin-read policy; the existing user-scoped policy is untouched.

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run:

```sql
create policy "saved_hostels_select_admin"
  on public.saved_hostels for select
  using (public.is_admin());
```

## 2. Verify

- **Access control**: while signed in as a non-admin, visit `/admin`
  directly by URL — you should be redirected to `/` before any admin UI
  renders (check the network tab / that no admin request ever fires). Set
  your account's `role` to `'admin'` in the SQL editor, reload — you
  should land on the dashboard.
- **Dashboard**: counts should match reality — spot check one (e.g.
  `select count(*) from public.hostels;` against the "Live hostels" card).
- **Add Hostel**: fill in just name, location, one room type + price, and
  a WhatsApp number — submit. It should appear on the public feed/map
  immediately (no submission queue), with `owner_id` null:
  `select owner_id from public.hostels order by created_at desc limit 1;`
  Try "Save & Add Another" — location should carry over, everything else
  should reset.
- **Edit**: open a hostel from the Hostels tab, change its name and remove
  a photo — save. Confirm the removed photo is actually gone from the
  Storage browser (`hostel-images` or `room-images` bucket), not just
  gone from the form.
- **Availability / Featured**: change availability from the list — the
  public details page should reflect it immediately. Turn Featured on
  with an expiry a few days out — the badge should show "Xd left"; set an
  expiry in the past and confirm the feed/map stop treating it as
  featured (the existing `isActivelyFeatured` logic already handles this,
  admin is just setting the values).
- **Delete**: delete a test hostel (with images) — confirm it's gone from
  the feed/map, and its Storage images are cleaned up.
