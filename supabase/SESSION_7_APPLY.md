# Applying Session 7

One migration this session — everything else (the `reviews` table, its
CHECK constraints, the `UNIQUE (hostel_id, author_id)` constraint, the
rating-recalculation trigger, and the author/admin RLS policies) already
shipped in Session 2 and needed no changes.

## 1. Apply the migration

`supabase/migrations/20260703140420_report_review_function.sql` adds a
single `report_review(p_review_id uuid)` function. Reporting needs to work
for *any* signed-in user, not just a review's author — but the existing
`reviews_update_author_or_admin` UPDATE policy (correctly) only lets a
review's author or an admin update it, since RLS can't restrict individual
columns on a row. Widening that policy so anyone could report would also
let anyone rewrite anyone else's rating or comment. Instead, this is a
`SECURITY DEFINER` function that can only ever flip `reported` to `true`,
callable by any authenticated user — same pattern already used by
`recalculate_hostel_rating` and `handle_new_user`.

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run:

```sql
create or replace function public.report_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required to report a review';
  end if;

  update public.reviews
  set reported = true
  where id = p_review_id;
end;
$$;

grant execute on function public.report_review(uuid) to authenticated;
```

## 2. Verify

- Sign in, open any hostel, scroll to Reviews — write a review under 15
  characters: blocked client-side with a friendly message.
- Post a valid review — it appears, the header's average/count update
  (from the Session 2 trigger, just refetched), and the write form is
  replaced by your review with Edit/Delete.
- Try posting a second review on the same hostel via a second browser tab
  signed in as the same user — the second attempt should fail with a
  friendly "already reviewed" message (the `UNIQUE` constraint, 23505).
- Sign out, confirm reviews are still readable, and the write area shows
  "Sign in to write a review" instead of the form.
- Tap "Report" on someone else's review — it flips to "Reported" and stays
  visible (no auto-hide). Confirm in the SQL editor:
  `select id, reported from public.reviews where reported = true;`
- Save a hostel, then review it as the same account — the review should
  carry a "Saved this hostel" badge. A review from the hostel's own
  `owner_id` should instead say "Submitted this listing". Neither ever
  says "Verified Resident".
- Open a hostel with zero reviews — the summary should read "No reviews
  yet — be the first to share your experience", never a bare "0.0".
