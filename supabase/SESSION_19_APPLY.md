# Applying Session 19 (Student Marketplace — Part 1)

One migration: `supabase/migrations/20260710000000_market_listings.sql`. It's
written to be **safely re-runnable** — every `CREATE` is guarded
(`IF NOT EXISTS` / `DROP ... IF EXISTS` then `CREATE` / `ON CONFLICT`), so if
a previous attempt got partway through and stopped, running the whole file
again from the top just finishes whatever's missing instead of erroring on
what already landed.

## 1. Apply the migration

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new),
clear it, paste the **full current contents** of
`supabase/migrations/20260710000000_market_listings.sql`, and run it.

What it does:

1. **`market_listings` table** — title/price/category/condition/images/
   contact/status, plus `hostel_id` and `is_leaving_sale` (nullable, unused
   this session — Session 20 wires those up).
2. **`protect_market_listing_writes` trigger** — forces `is_service` from
   `category` (never client-settable), pins `seller_id`/`views_count` on
   update, and only lets an admin move `status` to `'removed'` (sellers can
   still freely toggle active/sold on their own listing).
3. **RLS** — public read; insert requires `seller_id = auth.uid()` and
   blocks suspended accounts (same as reviews/submissions/Buzz); update/
   delete are seller-or-admin.
4. **`increment_listing_views`** — a public RPC (no auth required) so
   anonymous browsing still counts views, without letting a client set the
   count directly.
5. **`get_market_feed`** — the feed RPC: category/condition/price-range/
   free-only filters, text search, and three selectable sort orders
   (newest, price low→high, price high→low) with keyset pagination.
6. **`get_seller_public_profile`** — a small public RPC returning just a
   seller's name + join date. Needed because Session 15 locked
   `profiles` SELECT to self-or-admin — a stranger viewing someone else's
   listing can't read that seller's profile row directly, the same wall
   Buzz hit and solved by denormalizing a name column. A listing only
   needs this once, on-demand, at detail-view time, so a small RPC is a
   better fit than another denormalized column that could drift from the
   real profile.
7. **`market-images` storage bucket** — created with the Session 15
   hardening (10MB cap, JPEG/PNG/WebP only) baked in from the start, plus
   the same public-read / authenticated-insert / owner-update-delete
   policies as the other two image buckets.
8. **`app_config` table** — a small key/value config table, publicly
   readable, admin-writable. Seeds one row:
   `marketplace_enabled = false`.

## 2. Flip the marketplace on when you're ready

The whole feature ships behind that one flag, off by default. When you're
ready to launch (the brief says "one week after hostel launch"), run:

```sql
update public.app_config set value = 'true'::jsonb where key = 'marketplace_enabled';
```

`/market` reads this fresh on every request (deliberately not cached, and
the route is marked `force-dynamic` so Next doesn't freeze the flag's value
into a static build) — no redeploy needed, it takes effect on the next page
load. Flip it back to `'false'::jsonb` to re-gate it if you ever need to.

## 3. Verify

- [ ] With the flag `false`: `/market` shows the "coming soon" teaser, not
      the feed.
- [ ] After flipping to `true`: `/market` shows the real feed within one
      request (no rebuild needed).
- [ ] Sign in as a non-admin test account and post a listing — it should
      appear on the feed immediately (no admin approval step, unlike
      hostel submissions).
- [ ] Try uploading a `.svg` through the listing form's photo picker — the
      `market-images` bucket should reject it the same way `hostel-images`
      does.
- [ ] `scripts/security-audit.mjs` re-checks all of the above (and the
      write-authorization/tamper-protection rules) in one run — see that
      file's own header for how to run it.

## 4. Also needed (not SQL)

None this session beyond the migration above — no new Storage buckets to
configure by hand (the migration creates and hardens `market-images`
itself), no dashboard settings to change.
