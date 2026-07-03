import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { parseUploadedImages, type UploadedImage } from "@/lib/images";
import { haversineDistanceKm } from "@/lib/geo";
import { UMAT_CENTER } from "@/lib/map-constants";

export interface MapHostelPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  priceMin: number | null;
  priceMax: number | null;
  availability: string;
  ratingAvg: number;
  ratingCount: number;
  isActivelyFeatured: boolean;
  thumbnail: UploadedImage | null;
  distanceToCampusKm: number;
  // Not rendered directly -- only here so the map can filter pins
  // client-side with the exact same rules as the feed's RPC (see
  // lib/hostel-filters.ts).
  tags: string[];
  facilities: string[];
}

const MAP_HOSTEL_COLUMNS =
  "id, name, latitude, longitude, price_min, price_max, availability, rating_avg, rating_count, featured, featured_until, images, tags, facilities";

const UMAT_LATLNG = { lat: UMAT_CENTER[0], lng: UMAT_CENTER[1] };

// Only hostels with real coordinates -- no dispersion, no guessing. Fetches
// only what a pin/popup renders (same "fetch only what you render"
// discipline as the feed), not full hostel records.
export async function getMapHostels(supabase: SupabaseClient<Database>): Promise<MapHostelPin[]> {
  const { data, error } = await supabase
    .from("hostels")
    .select(MAP_HOSTEL_COLUMNS)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error) throw error;

  const now = Date.now();

  return (data ?? []).map((row) => {
    const featuredUntil = row.featured_until ? new Date(row.featured_until).getTime() : null;
    const images = parseUploadedImages(row.images);
    const latitude = row.latitude as number; // guaranteed non-null by the .not() filters above
    const longitude = row.longitude as number;

    return {
      id: row.id,
      name: row.name,
      latitude,
      longitude,
      priceMin: row.price_min,
      priceMax: row.price_max,
      availability: row.availability,
      ratingAvg: row.rating_avg,
      ratingCount: row.rating_count,
      isActivelyFeatured: row.featured && (featuredUntil === null || featuredUntil > now),
      thumbnail: images[0] ?? null,
      distanceToCampusKm: haversineDistanceKm(UMAT_LATLNG, { lat: latitude, lng: longitude }),
      tags: row.tags ?? [],
      facilities: row.facilities ?? [],
    };
  });
}
