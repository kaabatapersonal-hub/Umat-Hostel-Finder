# Applying Session 21: Launch Readiness

Two migrations land in this session -- Part 1 (graceful missing-data
handling) needed no schema changes at all, so this only covers Part 2.

## 1. Apply

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run the full contents of
`supabase/migrations/20260721000000_buzz_reactions.sql`. Safely
re-runnable if needed.

What it does:

- Adds `buzz_posts.reaction_counts` (jsonb, e.g. `{"🔥": 12, "👍": 5}`),
  trigger-maintained from `buzz_reactions` the same way `reply_count`
  already is.
- New table `buzz_reactions` (post_id, author_id, emoji -- CHECK-
  constrained to the 5 fixed emojis, unique per post+author+emoji).
- New RPC `toggle_buzz_reaction(p_post_id, p_emoji)` -- adds the
  reaction if it doesn't exist, removes it if it does, returns the new
  state. `security invoker`, same reasoning as `set_leaving_campus_mode`.

## 2. Verify

- [ ] On `/buzz`, each post shows a row of 5 emoji pills (🔥 👍 😂 💯 👀)
      below the content, above the reply count.
- [ ] Tapping a pill you haven't reacted with prompts sign-in if
      needed, then highlights it gold and bumps the count.
- [ ] Tapping it again removes your reaction and the count drops back.
- [ ] Counts persist across a refresh (server truth, not just local
      state).
- [ ] `scripts/security-audit.mjs`'s new "buzz: reactions" section
      passes -- toggle on/off, CHECK constraint on the emoji set, unique
      constraint against double-reacting, suspend enforcement, and
      author-only delete.

## 3. Also needed

Nothing beyond the migration above.
