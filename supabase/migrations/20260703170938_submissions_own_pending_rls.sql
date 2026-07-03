-- Session 8.5: a submitter can manage their own submission while it's
-- still pending -- Session 2 originally left UPDATE/DELETE admin-only.
-- Postgres RLS policies for the same command are OR'd together, so these
-- are additive: admin's existing full access is untouched, this just
-- grants the owner a narrower path.
--
-- The WITH CHECK on the update policy is doing double duty: requiring the
-- *new* row to still have submitted_by = auth.uid() and status = 'pending'
-- blocks two things at once -- reassigning the submission to someone else,
-- and self-approving/self-rejecting by changing status to anything but
-- 'pending'. No trigger needed, unlike protect_profile_role, because the
-- condition only ever needs to look at the new row's own values.

create policy "submissions_update_own_pending"
  on public.submissions for update
  using (submitted_by = auth.uid() and status = 'pending')
  with check (submitted_by = auth.uid() and status = 'pending');

create policy "submissions_delete_own_pending"
  on public.submissions for delete
  using (submitted_by = auth.uid() and status = 'pending');
