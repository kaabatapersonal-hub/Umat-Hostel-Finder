# Applying Session 11

One migration, plus an optional (but recommended) env var for email.

## 1. Apply the migration

`supabase/migrations/20260703234657_submission_review_functions.sql` — two
new admin-only RPCs, `approve_submission` and `reject_submission`. Both run
as a single SECURITY DEFINER call, so a failure partway through rolls back
everything in that call — approval can never leave a hostel half-created
with the submission not yet marked approved.

Open the
[SQL editor](https://supabase.com/dashboard/project/ebdmqflfnsqpaujhezgw/sql/new)
and run:

```sql
create or replace function public.approve_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
  v_hostel_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_submission from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if v_submission.status <> 'pending' then
    raise exception 'Submission is not pending';
  end if;

  insert into public.hostels (
    owner_id, name, location, distance_text, description, room_types,
    images, facilities, contact, call_number, latitude, longitude, tags
  ) values (
    v_submission.submitted_by, v_submission.name, v_submission.location, v_submission.distance_text,
    v_submission.description, v_submission.room_types, v_submission.images, v_submission.facilities,
    v_submission.contact, v_submission.call_number, v_submission.latitude, v_submission.longitude,
    v_submission.tags
  )
  returning id into v_hostel_id;

  update public.submissions set status = 'approved' where id = p_submission_id;

  return v_hostel_id;
end;
$$;

grant execute on function public.approve_submission(uuid) to authenticated;

create or replace function public.reject_submission(p_submission_id uuid, p_admin_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.submissions
  set status = 'rejected', admin_note = p_admin_note
  where id = p_submission_id and status = 'pending';

  if not found then
    raise exception 'Submission not found or not pending';
  end if;
end;
$$;

grant execute on function public.reject_submission(uuid, text) to authenticated;
```

## 2. Set up email (Resend) — optional but recommended

Add these to your Vercel project's environment variables (and `.env.local`
for local testing):

- `RESEND_API_KEY` — from your Resend dashboard.
- `RESEND_FROM_EMAIL` — e.g. `UMaT Hostel Finder <notifications@yourdomain.com>`.
  If unset, falls back to Resend's shared `onboarding@resend.dev` sender
  (works for testing, but a verified domain lands in inboxes far more
  reliably for real use).
- `NEXT_PUBLIC_SITE_URL` — your production URL (e.g.
  `https://umat-hostel-finder1.vercel.app`), used to build the "view your
  listing" link in the approval email. Falls back to Vercel's own
  `VERCEL_URL` if unset, then `localhost:3000`.

**Without `RESEND_API_KEY` set, everything still works** — approve/reject
still happen normally, the email step just silently no-ops (logged as a
non-fatal result, never blocks or rolls back the action). This is
intentional: the data action is the important part, email is best-effort.

## 3. Verify

- **Submissions**: approve a pending submission — a new hostel should
  appear on the public feed/map immediately, owned by the submitter
  (`select owner_id from public.hostels order by created_at desc limit
  1;` should match the submitter's id). Reject another with a note —
  confirm no hostel was created and the submitter's Profile shows
  "Rejected".
- **Atomicity**: hard to force a failure deliberately, but confirm a
  normal approve leaves exactly one new hostel row and the submission's
  status flips together, never one without the other.
- **Edit requests**: with Sunset Lodge's existing pending edit (from
  Session 8.5 testing) still sitting there, open `/admin/edit-requests` —
  you should see the diff (description changed). Apply it, then confirm
  `pending_changes` is null and `has_pending_edit` is false, and the live
  hostel's description actually changed — same `id` throughout.
- **Moderation**: report a review as a student, then from
  `/admin/moderation` dismiss it (should clear `reported`, review stays)
  or delete it (should remove it and recompute the hostel's rating).
- **Non-admin**: confirm a non-admin gets blocked on all of the above,
  including via direct API calls to the two new RPCs.
