# Applying the marketplace admin toggle

One small migration: `supabase/migrations/20260711000000_toggle_marketplace_rpc.sql`.
Adds a single RPC, `toggle_marketplace()` — admin-gated, flips
`app_config.marketplace_enabled` and returns the new value. Replaces the
"flip it via a direct SQL UPDATE" step from Session 19's apply doc with a
real button on the admin dashboard.

## 1. Apply

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run the full contents of
`supabase/migrations/20260711000000_toggle_marketplace_rpc.sql`. It's a
single `create or replace function` + `grant` — safe to run more than
once if needed.

## 2. Verify

- [ ] On `/admin`, the new "Student Marketplace" card shows the current
      state (green "Live" or grey "Coming soon") matching whatever
      `marketplace_enabled` is currently set to.
- [ ] Tapping the switch shows an inline confirm ("Disable marketplace?"
      / "Enable marketplace?" depending on current state) before doing
      anything.
- [ ] Confirming flips the badge and switch immediately (no page
      reload), and a fresh load of `/market` (in another tab) reflects
      the new state right away.
- [ ] Signed in as a non-admin, a direct call to `toggle_marketplace`
      is rejected — `scripts/security-audit.mjs` checks this (and that
      calling it twice as admin restores the flag to whatever it
      started as, so running the audit never leaves the live site's
      marketplace gate flipped from where it found it).

## 3. Also needed

Nothing beyond the migration above.
