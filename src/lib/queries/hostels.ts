import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { parseRoomTypes, type RoomTypeEntry } from "@/lib/room-types";
import { parseUploadedImages, type UploadedImage } from "@/lib/images";
import type { EditableHostelFields } from "@/lib/hostel-fields";
import { haversineDistanceKm } from "@/lib/geo";
import { UMAT_CENTER } from "@/lib/map-constants";

const UMAT_LATLNG = { lat: UMAT_CENTER[0], lng: UMAT_CENTER[1] };

export interface HostelCard {
  id: string;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  location: string;
  distanceText: string | null;
  images: UploadedImage[];
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
// supabase/migrations/20260702221215_room_types_pricing_facilities_contact.sql)
// — never fetch everything and filter in the browser.
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
    priceMin: row.price_min,
    priceMax: row.price_max,
    location: row.location,
    distanceText: row.distance_text,
    images: parseUploadedImages(row.images),
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
// left out (description, full images array, facilities, the manager's
// contact, etc). roomTypes replaces the old single price/room_type/
// room_images columns (Session 4.5) — each room type carries its own price
// and photos.
export interface HostelDetails {
  id: string;
  ownerId: string | null;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  roomTypes: RoomTypeEntry[];
  location: string;
  distanceText: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  images: UploadedImage[];
  facilities: string[];
  contact: string;
  callNumber: string | null;
  whatsappGroup: string | null;
  tags: string[];
  availability: string;
  availabilityUpdatedAt: string;
  isActivelyFeatured: boolean;
  ratingAvg: number;
  ratingCount: number;
  hasPendingEdit: boolean;
  // Straight-line (haversine), never a routed distance -- null when the
  // hostel has no coordinates yet. See lib/geo.ts.
  distanceToCampusKm: number | null;
}

const HOSTEL_DETAILS_COLUMNS =
  "id, owner_id, name, room_types, price_min, price_max, location, distance_text, latitude, longitude, description, images, facilities, contact, call_number, whatsapp_group, tags, availability, availability_updated_at, featured, featured_until, rating_avg, rating_count, has_pending_edit";

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

  const roomTypes = parseRoomTypes(data.room_types);
  const now = Date.now();
  const featuredUntil = data.featured_until ? new Date(data.featured_until).getTime() : null;

  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    priceMin: data.price_min,
    priceMax: data.price_max,
    roomTypes,
    location: data.location,
    distanceText: data.distance_text,
    latitude: data.latitude,
    longitude: data.longitude,
    description: data.description,
    images: parseUploadedImages(data.images),
    facilities: data.facilities ?? [],
    contact: data.contact,
    callNumber: data.call_number,
    whatsappGroup: data.whatsapp_group,
    tags: data.tags ?? [],
    availability: data.availability,
    availabilityUpdatedAt: data.availability_updated_at,
    isActivelyFeatured: data.featured && (featuredUntil === null || featuredUntil > now),
    ratingAvg: data.rating_avg,
    ratingCount: data.rating_count,
    hasPendingEdit: data.has_pending_edit,
    distanceToCampusKm:
      data.latitude != null && data.longitude != null
        ? haversineDistanceKm(UMAT_LATLNG, { lat: data.latitude, lng: data.longitude })
        : null,
  };
}

export interface GetRelatedHostelsParams {
  excludeId: string;
  location: string;
  priceMin: number | null;
  limit?: number;
}

// Fetch enough candidates to rank properly, but never the whole table --
// at today's (and V1-launch) hostel counts this is effectively "all of
// them" anyway, so no pagination/RPC is needed yet. Revisit if the
// catalog grows well past this.
const RELATED_CANDIDATE_LIMIT = 60;

function priceDistance(price: number | null, target: number | null): number {
  if (price == null || target == null) return Number.POSITIVE_INFINITY;
  return Math.abs(price - target);
}

// Backs both the desktop details sidebar ("More hostels") and the mobile
// details related-feed -- same simple heuristic for both, deliberately
// not over-engineered: same location area first, then closest by price
// (price_min proximity), then newest. Selects only card fields, same
// discipline as the main feed, so the resulting rows are drop-in
// HostelCard props.
export async function getRelatedHostels(
  supabase: SupabaseClient<Database>,
  { excludeId, location, priceMin, limit = 10 }: GetRelatedHostelsParams
): Promise<HostelCard[]> {
  const { data, error } = await supabase
    .from("hostels")
    .select(
      "id, name, price_min, price_max, location, distance_text, images, tags, availability, rating_avg, rating_count, featured, featured_until, created_at"
    )
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .limit(RELATED_CANDIDATE_LIMIT);

  if (error) throw error;

  const now = Date.now();

  const ranked = (data ?? [])
    .map((row) => {
      const featuredUntil = row.featured_until ? new Date(row.featured_until).getTime() : null;
      return {
        card: {
          id: row.id,
          name: row.name,
          priceMin: row.price_min,
          priceMax: row.price_max,
          location: row.location,
          distanceText: row.distance_text,
          images: parseUploadedImages(row.images),
          tags: row.tags ?? [],
          availability: row.availability,
          ratingAvg: row.rating_avg,
          ratingCount: row.rating_count,
          isActivelyFeatured: row.featured && (featuredUntil === null || featuredUntil > now),
        } satisfies HostelCard,
        sameLocation: row.location === location ? 0 : 1,
        priceGap: priceDistance(row.price_min, priceMin),
        createdAt: new Date(row.created_at).getTime(),
      };
    })
    .sort((a, b) => {
      if (a.sameLocation !== b.sameLocation) return a.sameLocation - b.sameLocation;
      if (a.priceGap !== b.priceGap) return a.priceGap - b.priceGap;
      return b.createdAt - a.createdAt;
    });

  return ranked.slice(0, limit).map((r) => r.card);
}

export interface OwnedHostelSummary {
  id: string;
  name: string;
  hasPendingEdit: boolean;
}

// Session 8.5: the owner-side entry point for "Edit listing" on Profile —
// every live hostel this user owns, plus whether an edit request is
// already sitting in the pending buffer for it.
export async function getMyOwnedHostels(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<OwnedHostelSummary[]> {
  const { data, error } = await supabase
    .from("hostels")
    .select("id, name, has_pending_edit")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({ id: row.id, name: row.name, hasPendingEdit: row.has_pending_edit }));
}

// The only way an owner can affect a live hostel row: propose a full
// replacement record into the pending_changes buffer via the
// submit_pending_edit() RPC (see
// supabase/migrations/20260703170944_hostel_pending_edit_flow.sql). There
// is deliberately no direct `.update()` path here -- Session 8.5 removed
// hostels' owner UPDATE policy entirely, so a direct update would just
// fail RLS.
export async function submitPendingEdit(
  supabase: SupabaseClient<Database>,
  hostelId: string,
  fields: EditableHostelFields
): Promise<void> {
  const pendingChanges = {
    name: fields.name,
    location: fields.location,
    distance_text: fields.distanceText,
    description: fields.description,
    room_types: fields.roomTypes,
    images: fields.images,
    facilities: fields.facilities,
    contact: fields.contact,
    call_number: fields.callNumber,
    latitude: fields.latitude,
    longitude: fields.longitude,
    tags: fields.tags,
  };

  const { error } = await supabase.rpc("submit_pending_edit", {
    p_hostel_id: hostelId,
    p_pending_changes: pendingChanges as unknown as Json,
  });

  if (error) throw error;
}
