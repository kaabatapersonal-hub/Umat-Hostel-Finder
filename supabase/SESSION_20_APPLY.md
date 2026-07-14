# Applying Session 20: Marketplace Differentiators

One migration: `supabase/migrations/20260712000000_marketplace_differentiators.sql`.
Activates the three Session 19 placeholder columns (`is_leaving_sale`,
`hostel_id`, `is_service`) and adds one new column (`service_type`).

## 1. Apply

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run the full contents of
`supabase/migrations/20260712000000_marketplace_differentiators.sql`.
It's written to be safely re-runnable if it needs to go more than once
(every `ALTER TABLE` uses `IF NOT EXISTS`, every trigger/function is
dropped-then-recreated).

What it does:

- Adds `profiles.is_leaving_sale` (boolean) and `profiles.leaving_date`
  (date) — the Leaving Campus Sale master switch lives on the *profile*,
  not the listing, since a listing-only flag can't answer "is this
  seller currently in leaving mode?" once listings get created/sold over
  time.
- Adds `market_listings.service_type` (text, CHECK-constrained to
  tutoring/design/programming/laundry/haircut_barber/photography/other).
- Redefines `protect_market_listing_writes()`: every new listing now
  auto-inherits `is_leaving_sale` from the seller's current profile flag
  (never client-settable), and `service_type` is force-nulled whenever
  `category` isn't `'services'` — the same tamper-proofing `is_service`
  already had.
- New RPC `set_leaving_campus_mode(p_enabled, p_leaving_date)` —
  bulk-activates/deactivates leaving mode: flips the profile switch and
  syncs `is_leaving_sale` onto every one of the caller's *active*
  listings in one round trip. `security invoker`, not `definer` — it
  only touches rows the caller's own RLS policies already let them
  touch.
- `get_seller_public_profile` and `get_market_feed` both grow new
  columns/filters (`is_leaving_sale`, `leaving_date`, `service_type`,
  `p_leaving_sale_only`, `p_service_type`) — both are drop-then-create
  in this migration since Postgres won't let `CREATE OR REPLACE` change
  a table-returning function's output columns.

## 2. Verify

- [ ] On Profile → My Marketplace Listings, the new "Leaving Campus
      Sale" toggle shows up. Turning it on prompts for an optional
      leaving date and, once confirmed, bulk-marks every one of your
      active listings as part of the sale.
- [ ] `/market/seller/<your-user-id>` shows your name, avatar, a
      "Leaving Campus" badge and leaving date (if set), all your active
      listings in a grid, a WhatsApp contact button, and a Share button
      — and it works when signed out too (open it in a private window).
- [ ] Creating a new listing while leaving mode is on automatically
      marks it as part of the sale, with no extra step.
- [ ] On `/market`, the "Leaving Sales" chip filters the feed to only
      leaving-sale listings; a "Leaving Sale" badge shows on affected
      cards.
- [ ] On any hostel's detail page, if a listing is linked to that
      hostel, an "Items for sale at [Hostel]" section appears after
      reviews (horizontal scroll, hidden entirely if there's nothing to
      show).
- [ ] The listing form's "Which hostel are you at?" dropdown pre-fills
      itself when you have exactly one saved hostel, but stays fully
      optional/changeable otherwise.
- [ ] A listing linked to a hostel shows "Seller is at [Hostel] →" on
      its detail page, linking back to that hostel.
- [ ] Choosing category "Services" in the listing form hides the
      condition picker, relabels price to "Rate (GHS)", shows an
      optional service-type picker, and changes the description
      placeholder. Service listings show no condition badge, a subtle
      accent, "From GHS X" pricing, and a service-appropriate WhatsApp
      message.
- [ ] Browsing category "Services" on the feed shows service-type chips
      instead of condition/price filters.
- [ ] `scripts/security-audit.mjs` passes its new "market:
      differentiators (Session 20)" section — bulk toggle scoping,
      the `service_type`/`hostel_id` constraints, and the RPC/filter
      changes.

## 3. Also needed

Nothing beyond the migration above.
