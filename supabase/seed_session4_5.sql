-- Session 4.5 test data: gives a couple of hostels multiple room types
-- (to exercise the price range on the card and the multi-row breakdown on
-- the details page) and varies call_number presence (to exercise the Call
-- button showing/hiding). Run after the migration.

-- Green Acres: two room types, both with photos -> range price on the
-- card, two priced+photographed rows on the details page. Also gets a
-- call_number so the Call button renders.
update public.hostels
set
  room_types = jsonb_build_array(
    jsonb_build_object(
      'type', '1_in_room',
      'price', 3200,
      'images', jsonb_build_array(
        'https://picsum.photos/seed/ga-single-1/600/600',
        'https://picsum.photos/seed/ga-single-2/600/600'
      )
    ),
    jsonb_build_object(
      'type', '2_in_room',
      'price', 2200,
      'images', jsonb_build_array('https://picsum.photos/seed/ga-double-1/600/600')
    )
  ),
  call_number = '+233200000099'
where name = 'Green Acres Hostel';

-- Sunset Lodge: three room types, no photos yet -> tests price-only rows
-- (photos are optional per type) and a wider price range.
update public.hostels
set room_types = jsonb_build_array(
  jsonb_build_object('type', '1_in_room', 'price', 3500, 'images', '[]'::jsonb),
  jsonb_build_object('type', '3_in_room', 'price', 2100, 'images', '[]'::jsonb),
  jsonb_build_object('type', '6_in_room', 'price', 1300, 'images', '[]'::jsonb)
)
where name = 'Sunset Lodge';

-- Kings Court: left with its single backfilled room type and no
-- call_number — tests the "single price, no dash" card + hidden Call button.
