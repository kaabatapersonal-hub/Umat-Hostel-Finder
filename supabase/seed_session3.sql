-- Session 3 test data: enough hostels to see pagination (page size 10),
-- featured-first ordering (including an EXPIRED featured hostel, which must
-- NOT sort to the top), and every filter chip actually filtering something.
--
-- Run in the Supabase SQL editor as postgres (bypasses RLS's admin-only
-- insert policy on hostels, same as the Session 2 test hostel).
--
-- Filter chip tag conventions (see get_hostel_feed migration):
--   "Near Campus" -> tags contains 'near_campus'
--   "En-suite"    -> facilities contains 'en_suite'

insert into public.hostels
  (name, price, location, distance_text, contact, availability, featured, featured_until, tags, facilities, created_at)
values
  ('Green Acres Hostel', 2200, 'North Campus', '12 mins walk', '+233200000001', 'available', true, null,
   array['near_campus'], array['wifi', 'water', 'en_suite'], now() - interval '1 day'),

  ('Kings Court Hostel', 1800, 'South Campus', '8 mins walk', '+233200000002', 'available', true, now() + interval '30 days',
   array['near_campus'], array['wifi', 'security'], now() - interval '2 days'),

  ('Sunset Lodge', 2600, 'Tarkwa Town', '20 mins walk', '+233200000003', 'filling', true, now() - interval '1 day',
   array[]::text[], array['water', 'generator'], now() - interval '3 days'),

  ('Campus View Hostel', 1500, 'North Campus', '5 mins walk', '+233200000004', 'available', false, null,
   array['near_campus'], array['wifi', 'en_suite', 'kitchen'], now() - interval '4 days'),

  ('Unity Hall Annex', 1900, 'East Campus', '10 mins walk', '+233200000005', 'available', false, null,
   array[]::text[], array['wifi', 'water'], now() - interval '5 days'),

  ('Golden Gate Hostel', 3200, 'Tarkwa Town', '25 mins walk', '+233200000006', 'full', false, null,
   array[]::text[], array['security', 'parking'], now() - interval '6 days'),

  ('Miners Rest Hostel', 1700, 'South Campus', '9 mins walk', '+233200000007', 'available', false, null,
   array['near_campus'], array['wifi', 'en_suite'], now() - interval '7 days'),

  ('Blue Roof Hostel', 2100, 'West Campus', '15 mins walk', '+233200000008', 'filling', false, null,
   array[]::text[], array['water', 'laundry'], now() - interval '8 days'),

  ('Palm Court Hostel', 1400, 'North Campus', '6 mins walk', '+233200000009', 'available', false, null,
   array['near_campus'], array['wifi', 'kitchen'], now() - interval '9 days'),

  ('Heritage Lodge', 2800, 'Tarkwa Town', '22 mins walk', '+233200000010', 'available', false, null,
   array[]::text[], array['security', 'generator', 'en_suite'], now() - interval '10 days'),

  ('Diamond Hostel', 1650, 'East Campus', '11 mins walk', '+233200000011', 'available', false, null,
   array[]::text[], array['wifi'], now() - interval '11 days'),

  ('Riverside Hostel', 1950, 'South Campus', '13 mins walk', '+233200000012', 'full', false, null,
   array['near_campus'], array['water', 'parking'], now() - interval '12 days'),

  ('Starlight Hostel', 1300, 'West Campus', '18 mins walk', '+233200000013', 'available', false, null,
   array[]::text[], array['wifi', 'en_suite'], now() - interval '13 days'),

  ('Emerald Hostel', 2400, 'North Campus', '7 mins walk', '+233200000014', 'available', false, null,
   array['near_campus'], array['wifi', 'water', 'security'], now() - interval '14 days');

-- Expect after running:
--   14 hostels total.
--   Feed order: Green Acres (actively featured, created 1 day ago) first,
--   then Kings Court (actively featured, created 2 days ago), then the rest
--   newest-first. Sunset Lodge is featured=true but featured_until is in the
--   past, so it must NOT appear in the featured group — it sorts by
--   created_at like everything else (3rd place, since it's the next newest).
--   Page size 10 -> first page has 10 rows, second page has the remaining 4.
