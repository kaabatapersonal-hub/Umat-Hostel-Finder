# Applying Session 21: Launch Readiness

Three migrations land in this session -- Part 1 (graceful missing-data
handling) needed no schema changes at all, so this only covers Part 2
(reactions) and Part 2b (GIF replies).

## 1. Apply

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run, in order:

1. `supabase/migrations/20260721000000_buzz_reactions.sql`
2. `supabase/migrations/20260722000000_buzz_reply_gifs.sql`

Both are safely re-runnable if needed.

What they do:

- Adds `buzz_posts.reaction_counts` (jsonb, e.g. `{"🔥": 12, "👍": 5}`),
  trigger-maintained from `buzz_reactions` the same way `reply_count`
  already is.
- New table `buzz_reactions` (post_id, author_id, emoji -- CHECK-
  constrained to the 5 fixed emojis, unique per post+author+emoji).
- New RPC `toggle_buzz_reaction(p_post_id, p_emoji)` -- adds the
  reaction if it doesn't exist, removes it if it does, returns the new
  state. `security invoker`, same reasoning as `set_leaving_campus_mode`.
- Adds `buzz_replies.gif_url`, and replaces the reply content CHECK
  constraint with one that requires *either* normal text (2-300 chars,
  same as before) *or* an https gif_url with empty content -- never
  both, never neither.

## 2. Also needed

`KLIPY_API_KEY` must be set in the Vercel project's environment
variables (server-side only, no `NEXT_PUBLIC_` prefix) -- you mentioned
this is already done. Without it, `/api/gifs` degrades to an empty
result set rather than erroring, so a missing key never breaks the rest
of Buzz.

## 3. Verify

- [ ] On `/buzz`, each post shows a row of 5 emoji pills (🔥 👍 😂 💯 👀)
      below the content, above the reply count.
- [ ] Tapping a pill you haven't reacted with prompts sign-in if
      needed, then highlights it gold and bumps the count.
- [ ] Tapping it again removes your reaction and the count drops back.
- [ ] Counts persist across a refresh (server truth, not just local
      state).
- [ ] On a post's detail page, the GIF button next to the reply input
      opens a picker (trending GIFs pre-loaded, search box on top).
- [ ] Tapping a GIF sends it immediately as a reply -- no separate
      "send" step -- and it renders as an image in the reply list.
- [ ] `scripts/security-audit.mjs`'s "buzz: reactions" and "buzz: GIF
      replies" sections both pass -- toggle on/off, CHECK constraints
      (emoji set, https-only gif_url, text-xor-gif), unique constraint
      against double-reacting, suspend enforcement, and author-only
      delete.
