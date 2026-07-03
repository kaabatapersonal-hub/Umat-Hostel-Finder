# Applying Session 6

Two things this session: a small schema migration, and Supabase Auth
dashboard configuration (no code covers this part — auth settings live in
the dashboard, not in a migration).

## 1. Apply the migration

`supabase/migrations/20260703013456_saved_hostels_cache_fields.sql` — a
clean rename/add (no real `saved_hostels` rows existed yet, since Save was
never wired to actually write until now). Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run:

```sql
-- Session 6: saved_hostels' cached display fields predate the pricing and
-- image model changes (Sessions 4.5 and 5) — a single hostel_price and a
-- bare hostel_image URL can't represent a price range or a blur placeholder
-- anymore. No real rows exist yet (Save was never wired to write), so this
-- is a clean rename/add, not a data migration.

alter table public.saved_hostels rename column hostel_price to hostel_price_min;
alter table public.saved_hostels add column hostel_price_max numeric;

alter table public.saved_hostels rename column hostel_image to hostel_image_url;
alter table public.saved_hostels add column hostel_image_blur text;
```

## 2. Configure Supabase Auth (dashboard, not code)

Go to your project's **Authentication → URL Configuration**:

- **Site URL**: set to your production URL (e.g.
  `https://umat-hostel-finder1.vercel.app`) once you know it's stable —
  this is the default redirect target Supabase falls back to.
- **Redirect URLs**: add both of these (magic link emails won't work
  without them — Supabase rejects any redirect not on this allowlist):
  - `http://localhost:3000/auth/callback`
  - `https://<your-production-domain>/auth/callback`

Email+password and magic link (email OTP) are both enabled by default on a
new Supabase project — no toggle needed for those. If "Confirm email" is
turned on under **Authentication → Providers → Email** (it is by default
for new projects), sign-up won't produce an immediate session; the app
already handles this (shows a "confirm your email" message instead of
silently failing to complete the save).

## 3. Verify

- Sign up with a real email + password in the app (not the kitchen-sink
  harness — the real `AuthSheet` sign-in flow now). If email confirmation
  is on, confirm via the email, then sign in for real.
- Close the tab, reopen `http://localhost:3000` — you should still be
  signed in (no re-login). This is the actual point of `proxy.ts`.
- Tap the heart on a hostel card while **signed out** — the auth sheet
  should rise, and after signing in, the save should complete automatically
  without you tapping the heart again.
- Open the same hostel in an incognito window, use "Email me a link" with
  the same address — you should land back signed in via `/auth/callback`
  (the "new device" case).
- Tap WhatsApp/Call on a hostel's details page **while fully signed out** —
  both should work immediately, no prompt at all.
- Visit `/profile` — real name/email/initials, saved list, submissions
  empty state, sign out button. Set your own `profiles.role` to `'admin'`
  (SQL editor) and confirm the Admin Panel entry appears; a normal student
  account should not see it.
