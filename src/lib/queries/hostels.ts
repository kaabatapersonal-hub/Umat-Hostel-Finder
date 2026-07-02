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

// The full record for the details page — everything the feed deliberately
// left out (description, full images array, room_images, facilities, the
// manager's contact, etc).
export interface HostelDetails {
  id: string;
  ownerId: string | null;
  name: string;
  price: number;
  location: string;
  distanceText: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  images: string[];
  roomImages: Partial<Record<"single" | "double" | "triple" | "quad", string[]>>;
  facilities: string[];
  roomType: string | null;
  contact: string;
  whatsappGroup: string | null;
  tags: string[];
  availability: string;
  availabilityUpdatedAt: string;
  isActivelyFeatured: boolean;
  ratingAvg: number;
  ratingCount: number;
}

const HOSTEL_DETAILS_COLUMNS =
  "id, owner_id, name, price, location, distance_text, latitude, longitude, description, images, room_images, facilities, room_type, contact, whatsapp_group, tags, availability, availability_updated_at, featured, featured_until, rating_avg, rating_count";

// Returns null when no hostel matches `id` — including a malformed id
// (bad/tampered link), which Postgres would otherwise reject with a
// 22P02 "invalid input syntax for uuid" error. Both cases mean the same
// thing to the UI: show the not-found state, not a retryable error.
export async function getHostelById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<HostelDetails | null> {
  const { data, error } = await supabase
    .from("hostels")
    .select(HOSTEL_DETAILS_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;

  const roomImages = (data.room_images ?? {}) as HostelDetails["roomImages"];
  const now = Date.now();
  const featuredUntil = data.featured_until ? new Date(data.featured_until).getTime() : null;

  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    price: data.price,
    location: data.location,
    distanceText: data.distance_text,
    latitude: data.latitude,
    longitude: data.longitude,
    description: data.description,
    images: data.images ?? [],
    roomImages,
    facilities: data.facilities ?? [],
    roomType: data.room_type,
    contact: data.contact,
    whatsappGroup: data.whatsapp_group,
    tags: data.tags ?? [],
    availability: data.availability,
    availabilityUpdatedAt: data.availability_updated_at,
    isActivelyFeatured: data.featured && (featuredUntil === null || featuredUntil > now),
    ratingAvg: data.rating_avg,
    ratingCount: data.rating_count,
  };
}
