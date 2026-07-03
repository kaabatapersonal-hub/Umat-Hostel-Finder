-- Session 6: saved_hostels' cached display fields predate the pricing and
-- image model changes (Sessions 4.5 and 5) — a single hostel_price and a
-- bare hostel_image URL can't represent a price range or a blur placeholder
-- anymore. No real rows exist yet (Save was never wired to write), so this
-- is a clean rename/add, not a data migration.

alter table public.saved_hostels rename column hostel_price to hostel_price_min;
alter table public.saved_hostels add column hostel_price_max numeric;

alter table public.saved_hostels rename column hostel_image to hostel_image_url;
alter table public.saved_hostels add column hostel_image_blur text;
