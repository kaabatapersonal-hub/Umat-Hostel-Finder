-- Session 21 Part 2b: GIF replies (Klipy)
--
-- A reply is either text or a GIF, not both -- the GIF picker sends
-- immediately on tap (Discord/Slack-style), it isn't a second field
-- alongside a typed message. gif_url is rendered as an <img src>, not a
-- clickable link, so the XSS surface a hostile whatsapp_group href would
-- have doesn't apply the same way here -- the `like 'https://%'` check
-- is still added as defense in depth against a client bypassing the app
-- and PATCHing a javascript:/data: URI directly via the API.
--
-- The original content CHECK constraint was declared inline
-- (`content text not null check (...)`), so its auto-generated name
-- isn't hardcoded here -- looked up and dropped dynamically instead of
-- guessed, then replaced with the version that also allows an empty
-- string when gif_url is set.

alter table public.buzz_replies add column if not exists gif_url text;

do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.buzz_replies'::regclass and contype = 'c'
  loop
    execute format('alter table public.buzz_replies drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.buzz_replies add constraint buzz_replies_content_or_gif_check
  check (
    (gif_url is null and char_length(content) >= 2 and char_length(content) <= 300)
    or (gif_url is not null and content = '' and (gif_url like 'https://%'))
  );

notify pgrst, 'reload schema';
