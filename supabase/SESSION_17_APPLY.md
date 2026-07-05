# Applying Session 17 (Buzz)

Two migrations: two new tables (no new RPCs), plus a same-session bugfix
caught by the audit script before this was ever committed.

## 1. Apply the migrations, in order

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run, in order:

1. The full contents of `supabase/migrations/20260706000000_buzz.sql`.
2. The full contents of
   `supabase/migrations/20260706010000_buzz_reply_count_trigger_fix.sql`
   — **required**, not optional. The first migration's own
   `protect_buzz_post_writes` trigger (which stops a client from
   tampering with `reply_count` directly) turned out to *also* block the
   legitimate internal recompute every time a reply was posted or
   deleted — every reply silently reset the count back to 0. This
   second migration replaces that one function with a corrected version
   (`pg_trigger_depth()` distinguishes "a client changed this row
   directly" from "another trigger's cascade changed this row"). If
   you already ran the first migration before seeing this, you still
   need to run the second one — it's a `create or replace function`,
   safe to apply on top.

What it does:

1. **Creates `buzz_posts` and `buzz_replies`**, both readable by anyone
   (including signed-out visitors), writable only by their author (or
   admin for updates/deletes).
2. **Denormalizes `author_name`** onto both tables, set server-side by
   trigger — this isn't in the session brief's literal schema, but it
   has to exist: Session 15 tightened `profiles` SELECT to
   `id = auth.uid() or is_admin()`, so a public Buzz reader can't join to
   another user's profile row to get their display name. Same fix
   `reviews.reviewer_name` already uses.
3. **`is_admin_post` is trigger-computed**, never client-settable — an
   "Official" badge only ever appears on a post whose author is
   currently an admin, recomputed fresh on every insert/update.
4. **`is_pinned` can only be changed by an admin** — enforced in the same
   trigger, even though RLS's row-level `author_id = auth.uid() or
   is_admin()` would otherwise let an author flip it on their own post.
5. **Pin cap of 3** — pinning a 4th post auto-unpins the oldest pinned
   one.
6. **`reply_count` is trigger-maintained** on `buzz_posts`, recomputed
   from `buzz_replies` on every insert/delete — same pattern as hostels'
   `rating_avg`/`rating_count`.
7. **Suspended accounts (Session 16) can't post or reply** — the same
   `not is_suspended()` check added to reviews/submissions in that
   session now also covers Buzz's two insert policies.

## 2. Verify

- The bottom nav now shows 5 tabs: Home · Map · Buzz · Saved · Profile.
- `/buzz` loads a feed (empty state if nothing's posted yet); the gold
  "+" button opens a compose sheet (gated by sign-in).
- Post something as a non-admin account — no "Official" badge. Post as
  the admin account — "Official" badge appears automatically.
- Tap a post → detail view with a reply box; keyboard doesn't cover the
  reply input on a real phone.
- As admin, pin a post (small pin icon on the card) — try pinning a 4th
  post and confirm the oldest pinned one auto-unpins.
- Try (via a direct API call, not the UI) to set `is_pinned=true` as a
  non-admin author on their own post — should silently revert.
- Dashboard shows a "Buzz posts" count.
- `scripts/security-audit.mjs` re-checks all of the above — see that
  file's header for how to run it.

## 3. Nothing dashboard-only this time

Everything in this session is code + one migration.
