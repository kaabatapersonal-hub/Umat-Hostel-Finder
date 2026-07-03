import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface SavedHostel {
  id: string; // saved_hostels row id
  hostelId: string;
  name: string | null;
  priceMin: number | null;
  priceMax: number | null;
  location: string | null;
  imageUrl: string | null;
  imageBlur: string | null;
  savedAt: string;
}

// What a card/details page has on hand when the user taps Save — cached
// onto the saved_hostels row so the Saved tab renders without joining back
// to hostels (see Session 2).
export interface SaveableHostelInput {
  id: string;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  location: string;
  imageUrl: string | null;
  imageBlur: string | null;
}

export async function getSavedHostels(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<SavedHostel[]> {
  const { data, error } = await supabase
    .from("saved_hostels")
    .select(
      "id, hostel_id, hostel_name, hostel_price_min, hostel_price_max, hostel_location, hostel_image_url, hostel_image_blur, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    hostelId: row.hostel_id,
    name: row.hostel_name,
    priceMin: row.hostel_price_min,
    priceMax: row.hostel_price_max,
    location: row.hostel_location,
    imageUrl: row.hostel_image_url,
    imageBlur: row.hostel_image_blur,
    savedAt: row.created_at,
  }));
}

export async function saveHostel(
  supabase: SupabaseClient<Database>,
  userId: string,
  hostel: SaveableHostelInput
): Promise<void> {
  const { error } = await supabase.from("saved_hostels").insert({
    user_id: userId,
    hostel_id: hostel.id,
    hostel_name: hostel.name,
    hostel_price_min: hostel.priceMin,
    hostel_price_max: hostel.priceMax,
    hostel_location: hostel.location,
    hostel_image_url: hostel.imageUrl,
    hostel_image_blur: hostel.imageBlur,
  });
  // 23505 = unique_violation — already saved (e.g. a double-tap raced the
  // network). Toggling is idempotent from the UI's perspective, so this
  // isn't a real error.
  if (error && error.code !== "23505") throw error;
}

export async function unsaveHostel(
  supabase: SupabaseClient<Database>,
  userId: string,
  hostelId: string
): Promise<void> {
  const { error } = await supabase.from("saved_hostels").delete().eq("user_id", userId).eq("hostel_id", hostelId);
  if (error) throw error;
}
