import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface LandingStats {
  hostelCount: number;
  roomOptionCount: number;
  reviewCount: number;
}

// Below this, a review count reads as embarrassing rather than reassuring
// -- the landing page simply omits the reviews stat until there's enough
// real signal to show (see about-page usage).
export const REVIEW_DISPLAY_THRESHOLD = 5;

// Live, not fake -- every number here is a real count against the current
// database, cached at the call site (see landing-stats-cached.ts) rather
// than faked or hardcoded. room_types is a jsonb array per hostel, not its
// own table, so "room options" needs the column fetched and summed in
// application code -- cheap at today's (and V1-launch) hostel counts.
export async function getLandingStats(supabase: SupabaseClient<Database>): Promise<LandingStats> {
  const [hostelsResult, roomTypesResult, reviewsResult] = await Promise.all([
    supabase.from("hostels").select("*", { count: "exact", head: true }),
    supabase.from("hostels").select("room_types"),
    supabase.from("reviews").select("*", { count: "exact", head: true }),
  ]);

  if (hostelsResult.error) throw hostelsResult.error;
  if (roomTypesResult.error) throw roomTypesResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  const roomOptionCount = (roomTypesResult.data ?? []).reduce(
    (sum, row) => sum + (Array.isArray(row.room_types) ? row.room_types.length : 0),
    0
  );

  return {
    hostelCount: hostelsResult.count ?? 0,
    roomOptionCount,
    reviewCount: reviewsResult.count ?? 0,
  };
}
