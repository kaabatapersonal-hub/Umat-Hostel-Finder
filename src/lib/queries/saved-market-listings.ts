import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface SavedMarketListing {
  id: string; // saved_market_listings row id
  listingId: string;
  title: string | null;
  price: number | null;
  imageUrl: string | null;
  imageBlur: string | null;
  savedAt: string;
}

// What a card/detail page has on hand when the user taps Save — cached onto
// the saved_market_listings row so the Saved tab renders without joining
// back to market_listings, same reasoning as SaveableHostelInput.
export interface SaveableListingInput {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  imageBlur: string | null;
}

export async function getSavedMarketListings(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<SavedMarketListing[]> {
  const { data, error } = await supabase
    .from("saved_market_listings")
    .select("id, listing_id, listing_title, listing_price, listing_image_url, listing_image_blur, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    title: row.listing_title,
    price: row.listing_price,
    imageUrl: row.listing_image_url,
    imageBlur: row.listing_image_blur,
    savedAt: row.created_at,
  }));
}

export async function saveMarketListing(
  supabase: SupabaseClient<Database>,
  userId: string,
  listing: SaveableListingInput
): Promise<void> {
  const { error } = await supabase.from("saved_market_listings").insert({
    user_id: userId,
    listing_id: listing.id,
    listing_title: listing.title,
    listing_price: listing.price,
    listing_image_url: listing.imageUrl,
    listing_image_blur: listing.imageBlur,
  });
  // 23505 = unique_violation — already saved (e.g. a double-tap raced the
  // network). Toggling is idempotent from the UI's perspective.
  if (error && error.code !== "23505") throw error;
}

export async function unsaveMarketListing(supabase: SupabaseClient<Database>, userId: string, listingId: string): Promise<void> {
  const { error } = await supabase.from("saved_market_listings").delete().eq("user_id", userId).eq("listing_id", listingId);
  if (error) throw error;
}
