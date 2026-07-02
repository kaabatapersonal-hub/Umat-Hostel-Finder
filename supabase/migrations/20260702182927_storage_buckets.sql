-- Storage buckets for hostel photos. Public read (images must load without
-- auth on the feed); only authenticated users can write. Path-scoping to
-- "only your own hostel/submission" is deferred to Session 5.

insert into storage.buckets (id, name, public)
values
  ('hostel-images', 'hostel-images', true),
  ('room-images', 'room-images', true)
on conflict (id) do nothing;

create policy "hostel_images_public_read"
  on storage.objects for select
  using (bucket_id = 'hostel-images');

create policy "hostel_images_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'hostel-images' and auth.role() = 'authenticated');

create policy "hostel_images_owner_update"
  on storage.objects for update
  using (bucket_id = 'hostel-images' and owner = auth.uid())
  with check (bucket_id = 'hostel-images' and owner = auth.uid());

create policy "hostel_images_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'hostel-images' and owner = auth.uid());

create policy "room_images_public_read"
  on storage.objects for select
  using (bucket_id = 'room-images');

create policy "room_images_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'room-images' and auth.role() = 'authenticated');

create policy "room_images_owner_update"
  on storage.objects for update
  using (bucket_id = 'room-images' and owner = auth.uid())
  with check (bucket_id = 'room-images' and owner = auth.uid());

create policy "room_images_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'room-images' and owner = auth.uid());
