-- Session 10: the admin dashboard needs a "Total saves" count across every
-- user, but saved_hostels' only policy (saved_hostels_all_own, Session 2)
-- scopes SELECT to the caller's own rows -- even for an admin. Additive
-- policy, same pattern as every other admin-read grant in this app: the
-- existing user-scoped policy is untouched, this just widens who can read
-- (never write) the whole table.

create policy "saved_hostels_select_admin"
  on public.saved_hostels for select
  using (public.is_admin());
