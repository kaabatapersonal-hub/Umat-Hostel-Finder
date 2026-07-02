-- Session 4 test data: enriches a few Session 3 seed hostels with the
-- fields the feed never needed but the details page does — description,
-- images, room_images, whatsapp_group — plus one stale availability
-- timestamp, so every section/state on the details page is reachable.
--
-- Image URLs are picsum.photos placeholders for verification only (the real
-- Supabase Storage upload pipeline is Session 5). next.config.ts allows
-- picsum.photos temporarily for this reason.

-- Green Acres: full gallery, both room types, WhatsApp group, description.
update public.hostels
set
  description = 'Green Acres Hostel sits a short walk from North Campus, with reliable water and power, a shared kitchen, and a quiet study-friendly compound. Rooms are cleaned weekly and the compound has 24/7 security.',
  images = array[
    'https://picsum.photos/seed/green-acres-1/800/600',
    'https://picsum.photos/seed/green-acres-2/800/600',
    'https://picsum.photos/seed/green-acres-3/800/600'
  ],
  room_images = jsonb_build_object(
    'single', jsonb_build_array('https://picsum.photos/seed/ga-single-1/600/600', 'https://picsum.photos/seed/ga-single-2/600/600'),
    'double', jsonb_build_array('https://picsum.photos/seed/ga-double-1/600/600')
  ),
  room_type = 'single',
  whatsapp_group = 'https://chat.whatsapp.com/exampleGreenAcresInvite'
where name = 'Green Acres Hostel';

-- Kings Court: one photo only (tests single-image gallery, no dots/count),
-- one room type only, no WhatsApp group (tests the banner hiding cleanly).
update public.hostels
set
  description = 'Kings Court Hostel is close to South Campus with dependable WiFi and a fenced, secure compound.',
  images = array['https://picsum.photos/seed/kings-court-1/800/600'],
  room_images = jsonb_build_object(
    'double', jsonb_build_array('https://picsum.photos/seed/kc-double-1/600/600', 'https://picsum.photos/seed/kc-double-2/600/600', 'https://picsum.photos/seed/kc-double-3/600/600')
  ),
  room_type = 'double'
where name = 'Kings Court Hostel';

-- Unity Hall Annex: zero images (tests the fallback placeholder end to
-- end) and a stale availability timestamp (tests the "may be outdated" hint).
update public.hostels
set
  description = 'A budget-friendly option on East Campus with basic amenities.',
  availability_updated_at = now() - interval '30 days'
where name = 'Unity Hall Annex';
