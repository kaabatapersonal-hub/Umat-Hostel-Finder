import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface HostelCard {
  id: string;
  name: string;
  price: number;
  location: string;
  distanceText: string | null;
  images: string[];
  tags: string[];
  availability: string;
  ratingAvg: number;
  ratingCount: number;
  isActivelyFeatured: boolean;
}

export interface HostelFilters {
  nearCampus: boolean;
  underBudget: boolean;
  availableNow: boolean;
  featuredOnly: boolean;
  enSuite: boolean;
}

export const DEFAULT_FILTERS: HostelFilters = {
  nearCampus: false,
  underBudget: false,
  availableNow: false,
  featuredOnly: false,
  enSuite: false,
};

export function hasActiveFilters(filters: HostelFilters): boolean {
  return Object.values(filters).some(Boolean);
}

export interface HostelCursor {
  featured: boolean;
  createdAt: string;
  id: string;
}

export interface GetHostelsParams {
  search?: string;
  filters?: HostelFilters;
  cursor?: HostelCursor | null;
  limit?: number;
}

export interface GetHostelsResult {
  hostels: HostelCard[];
  nextCursor: HostelCursor | null;
}

export const HOSTEL_FEED_PAGE_SIZE = 10;

// The single query behind the Discovery Feed. Server-side search + filters +
// keyset pagination via the get_hostel_feed RPC (see
// supabase/migrations/20260702190243_get_hostel_feed_function.sql) — never
// fetch everything and filter in the browser.
export async function getHostels(
  supabase: SupabaseClient<Database>,
  { search, filters = DEFAULT_FILTERS, cursor = null, limit = HOSTEL_FEED_PAGE_SIZE }: GetHostelsParams
): Promise<GetHostelsResult> {
  const trimmedSearch = search?.trim() || null;

  const { data, error } = await supabase.rpc("get_hostel_feed", {
    p_search: trimmedSearch,
    p_near_campus: filters.nearCampus,
    p_under_budget: filters.underBudget,
    p_available_now: filters.availableNow,
    p_featured_only: filters.featuredOnly,
    p_en_suite: filters.enSuite,
    p_cursor_featured: cursor?.featured ?? null,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit,
  });

  if (error) throw error;

  const rows = data ?? [];

  const hostels: HostelCard[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    location: row.location,
    distanceText: row.distance_text,
    images: row.images ?? [],
    tags: row.tags ?? [],
    availability: row.availability,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    isActivelyFeatured: row.is_actively_featured,
  }));

  const last = rows[rows.length - 1];
  const nextCursor: HostelCursor | null =
    rows.length === limit && last
      ? { featured: last.is_actively_featured, createdAt: last.created_at, id: last.id }
      : null;

  return { hostels, nextCursor };
}
