# Applying Session 22: Verified Users, Admin Permissions & Hostel Action Button

Four migrations, applied **in order** -- Part 2 depends on Part 1
(`protect_profile_role` gets redefined a second time), Part 3 is
independent of both, and the 4th is a fix for two real bugs the live
audit caught in Part 2 right after the first three were applied.

## 1. Apply

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run, **in this exact order**:

1. `supabase/migrations/20260723000000_verified_users.sql`
2. `supabase/migrations/20260723010000_admin_permissions.sql`
3. `supabase/migrations/20260723020000_hostel_action_config.sql`
4. `supabase/migrations/20260724000000_admin_permissions_fixes.sql`

All four are safely re-runnable if needed.

**Important:** Part 2 (`admin_permissions.sql`) makes `kaabatapersonal@gmail.com`
the one and only super admin, via a one-time `UPDATE ... WHERE email = ...`.
If that's not the email on the account you're using as admin, edit that
one line before running -- there is no other way to set the super admin
afterward (not through the UI, not through any RPC, by design).

What they do:

- **Part 1** adds `profiles.is_verified` / `verification_label`, a
  `set_user_verified` RPC, and a public `get_verified_profiles` batch
  lookup so a verified badge shows on content the user already posted
  before being verified, not just future posts.
- **Part 2** adds `profiles.is_super_admin` / `admin_permissions`, bootstraps
  the super admin, and retrofits every existing admin-gated RLS policy and
  RPC (hostels, submissions, reviews, Buzz, marketplace, user management)
  to check the specific permission instead of a blanket "any admin."
  `set_user_role` is extended (not rebuilt) to also set permissions and
  is now super-admin-only.
- **Part 3** seeds `app_config.team_whatsapp` (Simon's number, already
  used elsewhere in the app) for the new hostel-page "Something wrong?"
  action sheet.
- **The 4th migration** drops the old 2-argument `set_user_role` left
  over from Session 16 (it was silently making every promote/demote call
  ambiguous to PostgREST and failing outright -- caught by running the
  live audit right after applying the first three) and tightens two
  triggers (`is_pinned`, `status='removed'`) that were still checking
  "any admin" instead of the specific permission.

## 2. Verify

**Verified users:**
- [ ] In admin Users, tapping a student's row → "Verify" prompts for an
      optional label and sets the badge.
- [ ] The gold checkmark shows on that user's Buzz posts/replies,
      reviews, and marketplace listing seller line -- including content
      they posted *before* being verified.
- [ ] Tapping/hovering the badge shows the label, if one was set.
- [ ] "Remove verification" clears both the badge and the label.

**Admin permissions:**
- [ ] Signed in as `kaabatapersonal@gmail.com`, every admin tab is
      visible and the promote dialog shows the permission checkboxes.
- [ ] Promoting a test account with only e.g. "Moderate Buzz" checked:
      that account only sees the relevant tabs, and a direct API call to
      an unpermitted action (e.g. deleting a hostel) is rejected.
- [ ] That sub-admin cannot promote/demote anyone, including themselves.
- [ ] The super admin's row shows no "Demote" option anywhere, and
      `set_user_suspended`/`set_user_role` both reject targeting it.
- [ ] `scripts/security-audit.mjs`'s new "verified users" and "admin
      permissions" sections both pass.

**Hostel action button:**
- [ ] Every hostel detail page shows a "Something wrong with this
      listing?" link after the marketplace section, before "More
      hostels."
- [ ] Each of the 4 options opens the right WhatsApp message (with the
      hostel name filled in) or navigates to `/submit`.
- [ ] The number comes from `app_config.team_whatsapp`, not a hardcoded
      string in the component.

## 3. Also needed

Nothing beyond the three migrations above.
