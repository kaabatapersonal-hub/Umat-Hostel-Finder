-- Session 7: any authenticated user can flag a review as reported, without
-- being able to edit its content. The existing UPDATE policy
-- (reviews_update_author_or_admin, from Session 2) intentionally restricts
-- general updates to a review's own author or an admin -- widening it so
-- anyone could report would also let anyone rewrite anyone else's rating or
-- comment. A SECURITY DEFINER function that can only ever flip `reported`
-- to true gets the flagging behavior without touching that guarantee.

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
