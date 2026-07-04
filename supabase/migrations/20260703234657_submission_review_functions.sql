-- Session 11: the submission review queue. Both functions run as a single
-- SECURITY DEFINER call, so if anything inside fails, Postgres rolls back
-- the whole invocation -- approve_submission can never leave a hostel
-- half-inserted with the submission not yet marked approved (or vice
-- versa), without needing an explicit transaction block.

-- Copies a pending submission straight into a new, live hostels row (same
-- shape, no remapping, thanks to the Session 8 migration that brought
-- submissions up to hostels' field shapes) and sets owner_id to the
-- submitter -- this is the ownership plumbing Session 8.5's edit-request
-- flow was built for. Returns the new hostel's id.
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

-- Marks a pending submission rejected with an optional reason. Touches
-- nothing live -- no hostel is created or changed.
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
