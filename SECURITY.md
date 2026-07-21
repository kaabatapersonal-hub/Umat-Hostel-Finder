# Security

This is the living security record for Campa (formerly UMaT Hostel
Finder): what was
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

## Session 16: Admin User Management

Added a Users tab (list every profile, view a user's activity, promote/
demote, suspend/unsuspend, bulk-delete a user's reviews) and a
"Registered users" dashboard stat. New admin-only surface, so it got
the same adversarial treatment as everything else:

- **No new read policy was needed.** Session 15's `profiles_select_own_or_admin` already lets an admin read every profile; `reviews`/`submissions`/`saved_hostels`/`hostels` already OR `is_admin()` into (or are fully public in) their own SELECT policies. Only the *writes* below are new.
- **`set_user_role`/`set_user_suspended`/`get_user_activity_counts`/`delete_user_reviews`** are all `SECURITY DEFINER`, `search_path`-pinned, and gated with the same `if not is_admin() then raise exception` idiom as every other admin RPC — verified a non-admin caller gets rejected on all four.
- **Self-demotion and self-suspension are blocked** inside the RPCs themselves (not just disabled in the UI) — an admin can't accidentally lock themselves out, verified via direct API call.
- **Suspend enforcement is scoped to `reviews` and `submissions` INSERT**, not every write in the schema. This is deliberate: the brief's own use case is "a student spamming fake reviews or abusive content," and broadening a `not is_suspended()` check into every table's write policies (saved_hostels, roommate_*, etc.) would be a much larger, riskier diff for abuse vectors that don't actually exist yet. If a new abuse pattern shows up post-launch, extend `is_suspended()` into that table's policy the same way.
- **Verified the enforcement is real, not just cosmetic:** a test account was suspended *after* its session token was already issued, then that same stale token was used to attempt a review post and a submission — both rejected. This proves the check happens server-side on every request (RLS re-evaluates `is_suspended()` live), not just at sign-in — an already-logged-in abuser can't keep posting after being suspended.
- **Client-side kick-out is a UX nicety, not the security boundary.** `auth-provider.tsx` signs a suspended user out the next time it fetches their own profile (on load/auth-state-change). This was deliberately *not* added to `proxy.ts`'s middleware, which runs on every single request app-wide — a per-request DB round trip there for a rare edge case was judged not worth the blanket perf cost, given the RLS-layer enforcement above already holds regardless of what the client does.
- **No actual sign-in denial.** "Suspended" doesn't stop Supabase Auth from issuing a fresh session to a suspended account's credentials — that would need a Dashboard-configured Auth Hook (a project-level setting, not a migration). In practice it doesn't matter: the moment that session's profile is fetched, they're signed back out, and every write they'd want to make is rejected regardless.

## Session 17: Buzz

Added a tweet-style community board — `buzz_posts` + `buzz_replies`,
publicly readable, admin moderation. New public-write surface (anyone
signed in can post, not just admin), so it got the fullest adversarial
treatment yet:

- **`author_name` is denormalized onto both tables — a deviation from the session brief's literal schema, made necessary by Session 15.** Buzz must be readable by signed-out visitors, but Session 15 tightened `profiles` SELECT to `id = auth.uid() or is_admin()` — a public reader can't join to another user's profile to get their name. `reviews.reviewer_name` already solved this exact problem the same way; this reuses that precedent rather than reopening the profiles lockdown or building a new public name-lookup RPC. Resolved once at post time by trigger, never client-settable, never live-synced to later profile-name changes (same philosophy as `reviewer_name`).
- **`is_admin_post` and `author_name` are both trigger-recomputed on every insert/update**, ignoring whatever the client sent — verified via direct API that a non-admin including `is_admin_post: true` or a fake `author_name` in the request body gets silently overwritten.
- **`is_pinned` can only be changed by an admin**, enforced in the same trigger despite RLS's row-level `author_id = auth.uid() or is_admin()` otherwise allowing an author to touch their own row — the same column-vs-row gap Session 15 hit with reviews' `is_resident`/`reported`. Verified: a non-admin author flipping `is_pinned` on their own post gets reverted.
- **Pin cap of 3, trigger-enforced** (pinning a 4th auto-unpins the oldest) — verified with 4 real test posts pinned in sequence.
- **Suspended accounts (Session 16) are blocked here too** — the same `not is_suspended()` check extended to Buzz's two insert policies, since spamming Buzz posts is exactly the same abuse pattern Session 16's suspend feature exists for. Verified with the same stale-session-token technique: suspend an account whose token was already issued, then use that token to attempt a post/reply — both rejected.
- **A same-session bug the audit caught before this was ever committed:** the `reply_count`-tamper protection inside `protect_buzz_post_writes` (which reverts a client's attempt to PATCH `reply_count` directly) was *also* reverting the trigger-maintained recompute itself, since that recompute is just another UPDATE on `buzz_posts` and fired the same BEFORE UPDATE trigger. Every reply silently reset the count back to 0. Fixed with `pg_trigger_depth()` to distinguish a direct client statement (depth 1) from an update cascading in from another trigger (depth >1) — only the former resets `reply_count`. `is_pinned`'s protection didn't have this problem: its guard is `not is_admin()`, and `auth.uid()` stays the original caller's identity throughout a trigger cascade regardless of nesting, so an admin-initiated pin correctly sails through the pin-cap trigger's own cascading UPDATE without needing the same fix.
- **No new RPCs at all.** Reads are public, writes are author-or-admin RLS (same shape as reviews), and pin/delete are both plain updates/deletes an admin's existing RLS grant already covers — unlike Session 16's `profiles.role`, there was no privilege gap here needing a `SECURITY DEFINER` bypass.

## Session 19: Student Marketplace (Part 1)

Added `market_listings` (buy/sell/trade between students) behind a new
`app_config` feature-flag table, gated off by default. The moderation
model deliberately mirrors Buzz, not the hostel-submissions queue: live
immediately via public RLS insert, admin moderates after the fact — a
marketplace listing is much higher-volume and lower-stakes than a hostel
record, and requiring admin pre-approval on every listing would kill the
"under 60 seconds to post" goal outright.

- **Seller info needed a new small public RPC (`get_seller_public_profile`), not a denormalized column.** A listing detail page needs the seller's name and join date, and Session 15 locked `profiles` SELECT to self-or-admin — the same wall Buzz hit. But a listing only needs this once, on demand, at detail-view time (unlike a feed row, which needs a name on every single card) — a small `SECURITY DEFINER` RPC returning only `full_name`/`created_at` (never `email`/`role`) is a better fit here than another denormalized column that could drift from the real profile. Verified via direct API that the response never includes `email`.
- **`is_service` is trigger-derived from `category`, never client-settable** — verified a listing posted with `category: "electronics", is_service: true` comes back `is_service: false` regardless.
- **`status` can only move to `'removed'` (the admin moderation hide) if the caller is admin** — same column-vs-row gap as Buzz's `is_pinned`/reviews' `is_resident`. Sellers can still freely toggle `active`/`sold` on their own listing (that's the point of "mark as sold"); only the moderation state is gated. Verified: a seller PATCHing their own listing to `status: 'removed'` gets reverted; an admin doing the same succeeds.
- **A real bug the audit caught before this ever shipped:** the same trigger's `seller_id`/`views_count` tamper-protection (pinning both to their old values on every update, so a seller can't PATCH `views_count: 999999` alongside a legitimate edit) was *also* undoing `increment_listing_views`' own legitimate increment — that RPC's `UPDATE ... SET views_count = views_count + 1` looks identical to a tamper attempt from inside a row trigger, which has no way to know *which function* issued an UPDATE. Fixed by scoping the trigger to `BEFORE UPDATE OF <every column except views_count>` — Postgres only fires an "UPDATE OF column list" trigger when the statement's own SET clause names one of those columns, regardless of what any other trigger does afterward. A pure view-count-only update (the RPC's own statement) never fires this trigger at all now; any real edit — even one bundling a `views_count` tamper attempt alongside a legitimate field change — still fires it and still gets `views_count` reset. Caught by the audit script's own before-and-after `views_count` check, not by inspection.
- **`increment_listing_views` is intentionally anon-callable and unrate-limited.** A view is just a read; gating it behind auth would undercount every anonymous browse, and the worst case of no rate-limiting is an inflated-but-harmless popularity number, not a security issue — not worth dedup/abuse-detection machinery for a launch-week feature.
- **The `marketplace_enabled` flag had to be marked `export const dynamic = "force-dynamic"` on `/market/page.tsx`.** Without it, Next statically prerenders the page at build time (no `cookies()`/`searchParams` dependency to signal otherwise) and bakes in whatever the flag happened to be during that build — flipping it in the database would then need a full redeploy to take effect, defeating the entire point of a flag you can flip without one. Caught by inspecting the build's own route-type output (`○` static vs `ƒ` dynamic), not by a runtime test.
- **`app_config` is publicly readable, admin-writable-only.** The client needs to know whether to show the teaser or the real feed, so read access has to be public; write access is gated the same `is_admin()` way as every other admin-only table. Verified a non-admin PATCH to `app_config` is rejected.
- **`market-images` storage bucket was hardened at creation**, not bolted on after the fact the way Session 15 had to retrofit `hostel-images`/`room-images` — same 10MB cap, same JPEG/PNG/WebP allow-list, applied in the same migration that creates the bucket.

## Session 20: Marketplace Differentiators

Activated the three Session 19 placeholder columns (`is_leaving_sale`,
`hostel_id`, `is_service`) plus one new one (`service_type`), adding
Leaving Campus Sale, hostel-linked listings, and a services refinement.
No new tables, so the adversarial surface is smaller than Session 19's —
but two of the three features touch write paths that needed the same
column-vs-row scrutiny as everything before them.

- **Leaving Campus Sale's master switch lives on `profiles`, not on individual listings.** A listing-only flag can't answer "is this seller *currently* in leaving mode?" once listings get created, sold, or deleted over time, and the brief explicitly wants new listings to auto-inherit the mode — a per-listing flag has no way to express that. `profiles.is_leaving_sale`/`leaving_date` is the single source of truth; every new listing inherits it at INSERT time via `protect_market_listing_writes`, and the new `set_leaving_campus_mode` RPC bulk-syncs it onto existing active listings when the student flips the switch.
- **`set_leaving_campus_mode` is `SECURITY INVOKER`, not `DEFINER` — deliberately, unlike most of this project's other RPCs.** Both underlying UPDATEs (`profiles` where `id = auth.uid()`, `market_listings` where `seller_id = auth.uid()`) only ever touch rows the caller's own existing RLS policies already let them touch directly. There's no privilege gap to bridge here, so running it as invoker means RLS is still fully re-evaluated on every row the RPC touches — it's an atomicity/convenience wrapper (one round trip instead of two separate client-side updates that could partially fail), not a security boundary. The audit script has a check for this ("a stranger's call only flips their own listings, never another seller's") but it's currently skipped — it needs the second confirmed test identity (`SECURITY_AUDIT_OWNER_EMAIL`) the rest of the suite is also missing. Re-run once that account is confirmed.
- **A new listing's `is_leaving_sale` is unconditionally trigger-derived from the seller's profile flag at INSERT time, never client-settable** — the same tamper-proofing `is_service` already had. Verified a listing posted with `is_leaving_sale: false` explicitly in the request body still comes back `true` while the seller's leaving mode is active, and vice versa.
- **`service_type` reuses the exact `is_service` tamper-proofing pattern**: force-nulled by the trigger whenever `category` isn't `'services'`, regardless of what the client sends, and constrained to a fixed seven-value CHECK. Verified a spoofed `service_type` on a non-services listing comes back `null`.
- **`hostel_id` needed no new RLS at all** — it's just another nullable FK column on an already-public-read, seller-or-admin-write table. The FK constraint itself (not application code) is what stops a listing from pointing at a nonexistent hostel; verified a made-up UUID is rejected at the database level (`23503`).
- **`get_seller_public_profile` and `get_market_feed` both needed `DROP FUNCTION` + recreate, not `CREATE OR REPLACE`**, since both grew new *output* columns — Postgres allows `CREATE OR REPLACE FUNCTION` to add new *parameters* with defaults (compatible with existing callers), but not to change a table-returning function's result columns. Missing this distinction would have made the migration fail outright rather than silently do the wrong thing, so it surfaced immediately rather than needing to be caught by the audit.
- **No new abuse surface for suspended accounts** — Leaving Campus mode and hostel-linking both ride on `market_listings`' existing insert/update policies (`not is_suspended()` already applies), so nothing new needed extending there.
- **The seller sale page (`/market/seller/[userId]`) is fully public by design** — both reads it depends on (`get_seller_public_profile`, `market_listings` select) were already anon-callable from Session 19, since the whole point is a link a student can share to WhatsApp status without asking viewers to sign in first.

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
- [ ] **Storage bucket public-read scoping** — confirm only `hostel-images`/`room-images`/`market-images` are public, nothing else.
- [ ] **2FA + a strong, unique password** on GitHub, Vercel, Supabase, and Resend accounts. This one's genuinely yours — not something that can be done from code or a script.

## Pre-release checklist

Run through this before shipping any future release, not just this one:

1. `node scripts/security-audit.mjs` exits `0` (0 failures; skips/accepted-risks are fine and expected).
2. `npx tsc --noEmit`, `npx eslint`, `npx next build` all pass clean.
3. Manual dashboard actions above are all checked off (or already were, from a prior release).
4. Any new table, RPC, or storage bucket added since the last release has been added to the audit script's matrix.
5. If a real secret is ever found anywhere (git history, logs, a screenshot, anywhere) — **rotate it**, don't just remove it from the file. Deleting a committed secret doesn't undo its exposure.
