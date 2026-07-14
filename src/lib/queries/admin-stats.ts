import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface AdminStats {
  totalUsers: number;
  totalHostels: number;
  totalReviews: number;
  pendingSubmissions: number;
  totalSaves: number;
  hostelsWithPendingEdits: number;
  reportedReviews: number;
  activeFeaturedHostels: number;
  hostelsMissingCoordinates: number;
  totalBuzzPosts: number;
  activeMarketListings: number;
  marketListingsToday: number;
}

// Every number here is a Postgres COUNT via PostgREST's `count: "exact",
// head: true` (no rows transferred) -- never fetch a whole table just to
// size it. The one exception is "actively featured," which needs
// `featured_until > now()` evaluated client-side; featured hostels are a
// small subset, so fetching just that column for just those rows is still
// cheap.
export async function getAdminStats(supabase: SupabaseClient<Database>): Promise<AdminStats> {
  const [
    totalUsers,
    totalHostels,
    totalReviews,
    pendingSubmissions,
    totalSaves,
    hostelsWithPendingEdits,
    reportedReviews,
    hostelsMissingCoordinates,
    featuredRows,
    totalBuzzPosts,
    activeMarketListings,
    marketListingsToday,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("hostels").select("*", { count: "exact", head: true }),
    supabase.from("reviews").select("*", { count: "exact", head: true }),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("saved_hostels").select("*", { count: "exact", head: true }),
    supabase.from("hostels").select("*", { count: "exact", head: true }).eq("has_pending_edit", true),
    supabase.from("reviews").select("*", { count: "exact", head: true }).eq("reported", true),
    supabase.from("hostels").select("*", { count: "exact", head: true }).or("latitude.is.null,longitude.is.null"),
    supabase.from("hostels").select("featured_until").eq("featured", true),
    supabase.from("buzz_posts").select("*", { count: "exact", head: true }),
    supabase.from("market_listings").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("market_listings")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
  ]);

  for (const result of [
    totalUsers,
    totalHostels,
    totalReviews,
    pendingSubmissions,
    totalSaves,
    hostelsWithPendingEdits,
    reportedReviews,
    hostelsMissingCoordinates,
    featuredRows,
    totalBuzzPosts,
    activeMarketListings,
    marketListingsToday,
  ]) {
    if (result.error) throw result.error;
  }

  const now = Date.now();
  const activeFeaturedHostels = (featuredRows.data ?? []).filter(
    (row) => !row.featured_until || new Date(row.featured_until).getTime() > now
  ).length;

  return {
    totalUsers: totalUsers.count ?? 0,
    totalHostels: totalHostels.count ?? 0,
    totalReviews: totalReviews.count ?? 0,
    pendingSubmissions: pendingSubmissions.count ?? 0,
    totalSaves: totalSaves.count ?? 0,
    hostelsWithPendingEdits: hostelsWithPendingEdits.count ?? 0,
    reportedReviews: reportedReviews.count ?? 0,
    hostelsMissingCoordinates: hostelsMissingCoordinates.count ?? 0,
    activeFeaturedHostels,
    totalBuzzPosts: totalBuzzPosts.count ?? 0,
    activeMarketListings: activeMarketListings.count ?? 0,
    marketListingsToday: marketListingsToday.count ?? 0,
  };
}
