# Applying Session 15 (Security Hardening)

One migration, tightening five things. Nothing here removes a capability
any real user relies on — see the comments in the migration itself, and
`SECURITY.md` for the full reasoning behind each fix.

## 1. Apply the migration

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run the full contents of
`supabase/migrations/20260705120000_security_hardening.sql`.

What it does, in order:

1. **`profiles` SELECT policy tightened** — was readable by anyone
   (`using (true)`), which let any anon or authenticated request read
   every user's email and role. Now: your own row, or an admin. Verified
   against every place the app reads `profiles` — all are either a
   self-read or already admin-gated, so nothing breaks.
2. **Storage buckets get a real MIME allow-list + size cap** —
   `hostel-images`/`room-images` previously accepted any file type/size at
   the Storage level (the client-side compression/type-check is
   convenience, not enforcement). Now: JPEG/PNG/WebP only, 10MB ceiling.
3. **A trigger stops a review's author from tampering with moderation
   flags via a direct API call** — `is_resident` can no longer be changed
   after insert except by an admin, and `reported` can be set to `true` by
   anyone (that's the report mechanism working as intended) but only
   cleared back to `false` by an admin.
4. **A trigger caps pending submissions at 3 per account** — stops a
   flood of junk listings; approved/rejected ones don't count.
5. **`get_hostel_feed`'s `p_limit` is clamped to between 1 and 50** —
   stops an absurdly large value from returning the whole table in one
   call, and floors a negative/zero value to 1 row instead of erroring.

## 2. Verify

- Sign in as a non-admin test account and try `GET
  /rest/v1/profiles?select=email,role` for a user that isn't you — should
  return an empty array, not another user's data.
- Try uploading a `.svg` through the Submit form's photo picker — should
  be rejected (the bucket itself will now refuse it even if the client
  ever stopped checking).
- The full adversarial matrix in `scripts/security-audit.mjs` re-checks
  all of this (and everything that was already correct beforehand) in one
  run — see that file's own header for how to run it.

## 3. Also needed (not SQL — dashboard settings)

See `SECURITY.md`'s "Manual dashboard actions" section for the redirect
URL allow-list, password policy, auth rate limits, the Supabase
linter/advisor pass, and 2FA — none of these are migratable, they're
account/project settings only you can change.
