import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const ANALYTICS_ACTIVE_WINDOW_DAYS = 7;
export const ANALYTICS_GROWTH_WINDOW_DAYS = 30;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function assertNoError(results: { error: unknown }[]): void {
  for (const result of results) {
    if (result.error) throw result.error;
  }
}

export interface AdminUserGrowth {
  totalUsers: number;
  signups30d: number;
}

// Same zero-RPC shape as lib/queries/admin-stats.ts -- profiles already has
// an is_admin()-inclusive SELECT policy, so a plain PostgREST count with a
// created_at filter is all a 30-day signup count needs.
export async function getAdminUserGrowth(supabase: SupabaseClient<Database>): Promise<AdminUserGrowth> {
  const since = daysAgoIso(ANALYTICS_GROWTH_WINDOW_DAYS);

  const [totalUsers, signups30d] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since),
  ]);

  assertNoError([totalUsers, signups30d]);

  return {
    totalUsers: totalUsers.count ?? 0,
    signups30d: signups30d.count ?? 0,
  };
}

// The one number that isn't a plain PostgREST count -- "active" spans four
// tables (saves, reviews, Buzz posts, market listings), which needs a real
// UNION across them, not something the query builder can express
// client-side. See get_active_users_count in
// supabase/migrations/20260727000000_admin_analytics.sql.
export async function getAdminActiveUsers(supabase: SupabaseClient<Database>): Promise<number> {
  const since = daysAgoIso(ANALYTICS_ACTIVE_WINDOW_DAYS);
  const { data, error } = await supabase.rpc("get_active_users_count", { p_since: since });
  if (error) throw error;
  return data ?? 0;
}

export interface AdminEngagementStats {
  totalSaves: number;
  saves30d: number;
  totalBuzzPosts: number;
  buzzPosts30d: number;
  totalReviews: number;
  reviews30d: number;
}

// Same zero-RPC shape again -- saved_hostels has the same admin-inclusive
// SELECT policy as profiles, and reviews/buzz_posts are fully public-read
// already (see the migration comments for both), so every one of these is
// just a count query, optionally with a created_at filter.
export async function getAdminEngagementStats(supabase: SupabaseClient<Database>): Promise<AdminEngagementStats> {
  const since = daysAgoIso(ANALYTICS_GROWTH_WINDOW_DAYS);

  const [totalSaves, saves30d, totalBuzzPosts, buzzPosts30d, totalReviews, reviews30d] = await Promise.all([
    supabase.from("saved_hostels").select("*", { count: "exact", head: true }),
    supabase.from("saved_hostels").select("*", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("buzz_posts").select("*", { count: "exact", head: true }),
    supabase.from("buzz_posts").select("*", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("reviews").select("*", { count: "exact", head: true }),
    supabase.from("reviews").select("*", { count: "exact", head: true }).gte("created_at", since),
  ]);

  assertNoError([totalSaves, saves30d, totalBuzzPosts, buzzPosts30d, totalReviews, reviews30d]);

  return {
    totalSaves: totalSaves.count ?? 0,
    saves30d: saves30d.count ?? 0,
    totalBuzzPosts: totalBuzzPosts.count ?? 0,
    buzzPosts30d: buzzPosts30d.count ?? 0,
    totalReviews: totalReviews.count ?? 0,
    reviews30d: reviews30d.count ?? 0,
  };
}
