-- Session 22 Part 3: hostel page action button config
--
-- Reuses the existing app_config table (Session 19) rather than a new
-- one -- same "single key/value table, not a one-off column" reasoning
-- as marketplace_enabled. Publicly readable via app_config's existing
-- "using (true)" select policy (the action sheet needs it client-side
-- to build wa.me links, signed-in or not) and not admin-editable
-- through the UI this session -- update it via SQL if the number ever
-- needs to change (see SECURITY.md's Session 22 Part 3 section for why
-- that's an acceptable scope trim, not an oversight).
insert into public.app_config (key, value) values ('team_whatsapp', '"233257653283"'::jsonb)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
