# Security

This is the living security record for UMaT Hostel Finder: what was
checked, what was found, what got fixed, what's being knowingly
accepted, and what's left for a human to do in a dashboard somewhere.
It's meant to be re-read (and the audit script re-run) before every
future release, not just once.

**Methodology.** Every check below was made the way an attacker would
make it: direct calls to the Supabase REST/RPC/Storage API and the
app's own HTTP endpoints, using real anon/authenticated/admin tokens,
never through the UI. The UI enforces nothing — Postgres Row-Level
Security (RLS), triggers, and server-side route checks are the actual
boundaries, and that's what was tested. The full matrix is codified in
[`scripts/security-audit.mjs`](scripts/security-audit.mjs); run it
before every release (see that file's header for setup/env vars).

## Findings

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **High** | `profiles` was readable by anyone (`using (true)`) — any anonymous or authenticated request could harvest every user's email and role. | **Fixed** — `20260705120000_security_hardening.sql`: policy now `id = auth.uid() or is_admin()`. Verified: anon/stranger reads of another user's row now return zero rows. |
| 2 | Medium | `hostel-images`/`room-images` storage buckets had no server-side MIME or size enforcement — client-side checks are convenience, not a boundary; a direct API call could upload anything (including SVG, which can carry inline `<script>`). | **Fixed** — bucket-level `allowed_mime_types` (jpeg/png/webp only) + `file_size_limit` (10MB). Verified: SVG upload rejected, legitimate PNG upload still succeeds. |
| 3 | Medium | A review's author could PATCH `is_resident` or clear their own `reported` flag via a direct API call, bypassing the app's honesty guarantees for both fields. | **Fixed** — `protect_review_flags` trigger: `is_resident` is admin-only after insert; `reported` can still go false→true by anyone (that's `report_review()` working as intended) but only true→false by an admin. |
| 4 | Low | No cap on pending submissions per account — a single user could flood the moderation queue with junk listings. | **Fixed** — `limit_pending_submissions` trigger caps a user at 3 simultaneous `pending` submissions; approved/rejected ones don't count against it. |
| 5 | Low | `whatsapp_group` is a free-text URL column rendered directly as an anchor `href` with no scheme check — a `javascript:`/`data:` URL landed there (no UI writes it today, but RLS is row-level, not column-level) would execute in the app's own origin. | **Fixed** — `isSafeHttpUrl()` in `src/lib/contact.ts`; the banner now renders nothing unless the value is a plain `https://` URL. |
| 6 | Low | `get_hostel_feed`'s `p_limit` had no upper bound — an absurd value could return the entire table in one RPC call. | **Fixed** — clamped to `least(greatest(p_limit, 1), 50)`. |
| 7 | Low | No security-relevant response headers set. | **Fixed** — `next.config.ts` now sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` on every route. HSTS is left to Vercel's platform default; a full CSP is deliberately out of scope (see Accepted risks). |

### Verified safe (no fix needed)

- **`api/admin/submission-notify`** re-verifies the session (`auth.getUser()`) and the caller's `profiles.role === 'admin'` server-side, independent of any client claim. A request with no session gets a real 401.
- **Every `SECURITY DEFINER` function** (`report_review`, `get_hostel_feed`, `submit_pending_edit`, `apply_pending_changes`, `approve_submission`, `reject_submission`) already had `search_path` pinned to `public` — no schema-injection privilege escalation vector.
- **No secrets in git history.** Full `git log --all -p` scanned for JWT/API-key/password-literal patterns across all commits — nothing real (one harmless false-positive on `autoComplete="current-password"`).
- **No service-role key anywhere in the codebase.** The app is anon-key-only; RLS is the only thing standing between a request and the data, by design, everywhere.
- **No `dangerouslySetInnerHTML`** anywhere in the app.
- **`wa.me`/`tel:` links are injection-safe by construction** — `normalizePhoneNumber()` strips everything but digits before a URL is ever built.
- **RLS matrix** across `profiles`, `hostels`, `submissions`, `reviews`, `saved_hostels`, `roommate_profiles`, `roommate_requests` for anonymous / authenticated-stranger / owner / admin — see `scripts/security-audit.mjs` for the full, re-runnable matrix.

## Accepted risks

Things that are knowingly *not* fixed, and why:

- **`hostels.pending_changes` is technically readable via a direct API call** (e.g. `?select=pending_changes`) by anyone, even though the app itself never requests that column for a non-admin. RLS in Postgres is **row-level only** — it can't hide one column while allowing the rest of the same row to the same role. Properly closing this would mean a dedicated RPC (or a view with an explicit column list) plus an app-code change to use it, which risked destabilizing the already-shipped, tested admin edit-review flow under audit time pressure. Revisit if `pending_changes` ever comes to hold something more sensitive than a preview of a hostel's own public fields.
- **2 moderate `npm audit` findings**, both transitive through Next.js's own bundled `postcss` — no fix exists without downgrading Next.js itself (to a version far too old to use). Low real-world impact: build-time tooling, not code that runs in a deployed request path.
- **No full Content-Security-Policy.** A CSP tight enough to matter would need careful tuning against Leaflet's inline-styled markers, CARTO tile origins, and Supabase Storage — a broken CSP (blocked map tiles, blocked contact links) is worse for users than none. Basic headers (frame/sniff/referrer) are in place instead. Worth a dedicated pass later, not bundled into this one.
- **Six audit-script checks are currently skipped**, not failed: they need a *second, genuinely distinct* non-admin identity (a confirmed `SECURITY_AUDIT_OWNER_EMAIL` test account) to prove things like "user A can't read user B's saves." The audit script falls back to using the stranger account as a stand-in owner when that account isn't confirmed yet, which still exercises every RLS policy correctly for owner-vs-admin and anon-vs-authenticated — it just can't prove the narrower two-distinct-strangers cases. Confirm `kaabatapersonal+audit-owner@gmail.com` and re-run for full coverage.
- **Pentesting, CAPTCHA, DDoS protection beyond Vercel/Supabase platform defaults, and encrypting data that's already public by design** were explicitly out of scope for this session (see the Session 15 brief) — noted here so it isn't mistaken for an oversight.

## Manual dashboard actions (not code — do these in Supabase/Vercel/GitHub)

None of these are migratable; they're account or project settings only a human with dashboard access can change.

- [ ] **Auth redirect URL allow-list** — Supabase Dashboard → Authentication → URL Configuration: restrict to the real production domain + local dev only.
- [ ] **Password policy** — Authentication → Policies: require 10+ characters, enable leaked-password protection (HaveIBeenPwned check).
- [ ] **Auth rate limits** — Authentication → Rate Limits: confirm the defaults for sign-in/sign-up/OTP attempts are on and reasonable.
- [ ] **Supabase linter/advisor** — Database → Advisors: run it, review anything flagged.
- [ ] **Database backups** — confirm automatic backups are enabled (or take a manual one before any future risky migration).
- [ ] **Storage bucket public-read scoping** — confirm only `hostel-images`/`room-images` are public, nothing else.
- [ ] **2FA + a strong, unique password** on GitHub, Vercel, Supabase, and Resend accounts. This one's genuinely yours — not something that can be done from code or a script.

## Pre-release checklist

Run through this before shipping any future release, not just this one:

1. `node scripts/security-audit.mjs` exits `0` (0 failures; skips/accepted-risks are fine and expected).
2. `npx tsc --noEmit`, `npx eslint`, `npx next build` all pass clean.
3. Manual dashboard actions above are all checked off (or already were, from a prior release).
4. Any new table, RPC, or storage bucket added since the last release has been added to the audit script's matrix.
5. If a real secret is ever found anywhere (git history, logs, a screenshot, anywhere) — **rotate it**, don't just remove it from the file. Deleting a committed secret doesn't undo its exposure.
