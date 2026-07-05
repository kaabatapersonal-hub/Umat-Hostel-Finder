# Applying Session 16 (Admin User Management)

One migration, adding a suspend flag and four new admin-only RPCs.
Nothing here loosens the `profiles` read tightening from Session 15 —
the Users tab reads through the same admin-or-self RLS policy that
already exists; only the *write* actions below are new.

## 1. Apply the migration

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run the full contents of
`supabase/migrations/20260705200000_admin_user_management.sql`.

What it does, in order:

1. **Adds `profiles.is_suspended`** (`boolean not null default false`).
2. **Adds `is_suspended()`**, a helper the same shape as `is_admin()`.
3. **Tightens the `reviews`/`submissions` INSERT policies** to also
   require `not is_suspended()` — a suspended account can no longer
   post a new review or submission, checked at the database level on
   every request regardless of how stale their session token is. This
   is a deliberate, narrower scope than "block every write anywhere" —
   see `SECURITY.md` for the reasoning.
4. **Adds `set_user_role(p_user_id, p_role)`** — promote/demote, admin-
   gated, blocks self-demotion.
5. **Adds `set_user_suspended(p_user_id, p_suspended)`** — suspend/
   unsuspend, admin-gated, blocks self-suspension.
6. **Adds `get_user_activity_counts(p_user_ids)`** — batched review/
   save/submission/owned-hostel counts for the Users list, one round
   trip per page instead of N+1 queries.
7. **Adds `delete_user_reviews(p_user_id)`** — bulk-deletes every review
   by one account, for the "several abusive reviews, one account"
   cleanup case.

## 2. Verify

- Dashboard shows a "Registered users" card with a real count.
- Admin → Users lists every profile, newest first; search by name/email
  works; the All/Admins/Students filter chips work.
- Tapping a row opens the detail sheet with reviews/saves/submissions/
  owned hostels and the promote/suspend actions.
- Promote a test (non-admin) account to admin, then sign in as that
  account — they should now see the admin panel.
- Try to demote or suspend *yourself* (the account you're signed in
  as) — both should be blocked (button disabled client-side, RPC
  rejects it server-side either way).
- Suspend a test account, then — using that account's *already-issued*
  session token, not a fresh sign-in — try posting a review or
  submission via a direct API call. It should be rejected. This is the
  important one: it proves suspension isn't just a login-time check.
- `scripts/security-audit.mjs` re-checks all of this — see that file's
  own header for how to run it, and `SECURITY.md` for what each new
  check verifies.

## 3. Nothing dashboard-only this time

Everything in this session is code + one migration — no new Supabase
dashboard settings to change.
