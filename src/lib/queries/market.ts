import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MarketCategory, MarketCondition, MarketListingStatus } from "@/lib/supabase/database.types";
import { parseUploadedImages, type UploadedImage } from "@/lib/images";
import { deleteImageFromStorage } from "@/lib/storage-upload";

export interface MarketListing {
  id: string;
  sellerId: string;
  title: string;
  description: string | null;
  price: number;
  category: MarketCategory;
  condition: MarketCondition | null;
  images: UploadedImage[];
  contact: string;
  isService: boolean;
  status: MarketListingStatus;
  isLeavingSale: boolean;
  viewsCount: number;
  createdAt: string;
}

// The feed RPC only ever returns status='active' rows (see get_market_feed's
// own `where status = 'active'`) and doesn't select the column at all --
// callers of getMarketFeed always get "active" here, which is simply true.
function mapFeedRow(row: {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  condition: string | null;
  images: unknown;
  contact: string;
  is_service: boolean;
  is_leaving_sale: boolean;
  views_count: number;
  created_at: string;
}): MarketListing {
  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description,
    price: row.price,
    category: row.category as MarketCategory,
    condition: row.condition as MarketCondition | null,
    images: parseUploadedImages(row.images),
    contact: row.contact,
    isService: row.is_service,
    status: "active",
    isLeavingSale: row.is_leaving_sale,
    viewsCount: row.views_count,
    createdAt: row.created_at,
  };
}

export const MARKET_FEED_PAGE_SIZE = 20;

export type MarketSort = "newest" | "price_asc" | "price_desc";

export interface MarketCursor {
  createdAt: string;
  price: number;
  id: string;
}

export interface MarketFeedFilters {
  search?: string;
  category?: MarketCategory | null;
  condition?: MarketCondition | null;
  freeOnly?: boolean;
  priceMin?: number | null;
  priceMax?: number | null;
  sort?: MarketSort;
}

export const DEFAULT_MARKET_FILTERS: MarketFeedFilters = {
  category: null,
  condition: null,
  freeOnly: false,
  priceMin: null,
  priceMax: null,
  sort: "newest",
};

export function hasActiveMarketFilters(filters: MarketFeedFilters): boolean {
  return (
    !!filters.category ||
    !!filters.condition ||
    !!filters.freeOnly ||
    filters.priceMin != null ||
    filters.priceMax != null ||
    (!!filters.sort && filters.sort !== "newest")
  );
}

export interface GetMarketFeedResult {
  listings: MarketListing[];
  nextCursor: MarketCursor | null;
}

// Keyset pagination via one RPC supporting three selectable sort orders --
// see the migration's own comment on why the cursor always carries both
// createdAt and price regardless of which one the current sort actually
// uses.
export async function getMarketFeed(
  supabase: SupabaseClient<Database>,
  {
    search,
    filters = DEFAULT_MARKET_FILTERS,
    cursor,
    limit = MARKET_FEED_PAGE_SIZE,
  }: { search?: string; filters?: MarketFeedFilters; cursor?: MarketCursor | null; limit?: number } = {}
): Promise<GetMarketFeedResult> {
  const { data, error } = await supabase.rpc("get_market_feed", {
    p_search: search?.trim() || null,
    p_category: filters.category ?? null,
    p_condition: filters.condition ?? null,
    p_free_only: filters.freeOnly ?? false,
    p_price_min: filters.priceMin ?? null,
    p_price_max: filters.priceMax ?? null,
    p_sort: filters.sort ?? "newest",
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_price: cursor?.price ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit,
  });

  if (error) throw error;

  const rows = data ?? [];
  const listings = rows.map(mapFeedRow);
  const last = rows[rows.length - 1];
  const nextCursor = rows.length === limit && last ? { createdAt: last.created_at, price: last.price, id: last.id } : null;

  return { listings, nextCursor };
}

const LISTING_COLUMNS =
  "id, seller_id, title, description, price, category, condition, images, contact, is_service, status, is_leaving_sale, views_count, created_at";

interface ListingRow {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  condition: string | null;
  images: unknown;
  contact: string;
  is_service: boolean;
  status: string;
  is_leaving_sale: boolean;
  views_count: number;
  created_at: string;
}

function mapListingRow(row: ListingRow): MarketListing {
  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description,
    price: row.price,
    category: row.category as MarketCategory,
    condition: row.condition as MarketCondition | null,
    images: parseUploadedImages(row.images),
    contact: row.contact,
    isService: row.is_service,
    status: row.status as MarketListingStatus,
    isLeavingSale: row.is_leaving_sale,
    viewsCount: row.views_count,
    createdAt: row.created_at,
  };
}

export async function getMarketListingById(supabase: SupabaseClient<Database>, id: string): Promise<MarketListing | null> {
  const { data, error } = await supabase.from("market_listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle();

  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ? mapListingRow(data) : null;
}

// Same JS-side ranking heuristic as getRelatedHostels: same category
// first, then closest price, then newest -- deliberately simple, viable
// because the candidate fetch is capped rather than ranked in SQL.
const RELATED_CANDIDATE_LIMIT = 60;

export interface GetRelatedMarketListingsParams {
  excludeId: string;
  category: string;
  price: number;
  limit?: number;
}

export async function getRelatedMarketListings(
  supabase: SupabaseClient<Database>,
  { excludeId, category, price, limit = 10 }: GetRelatedMarketListingsParams
): Promise<MarketListing[]> {
  const { data, error } = await supabase
    .from("market_listings")
    .select(LISTING_COLUMNS)
    .eq("status", "active")
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .limit(RELATED_CANDIDATE_LIMIT);

  if (error) throw error;

  const ranked = (data ?? []).map((row) => {
    const listing = mapListingRow(row);
    return {
      listing,
      sameCategory: listing.category === category ? 0 : 1,
      priceGap: Math.abs(listing.price - price),
      createdAtMs: new Date(listing.createdAt).getTime(),
    };
  });

  ranked.sort((a, b) => {
    if (a.sameCategory !== b.sameCategory) return a.sameCategory - b.sameCategory;
    if (a.priceGap !== b.priceGap) return a.priceGap - b.priceGap;
    return b.createdAtMs - a.createdAtMs;
  });

  return ranked.slice(0, limit).map((r) => r.listing);
}

export interface AdminMarketListingRow extends MarketListing {
  sellerName: string | null;
  sellerEmail: string | null;
}

const ADMIN_LISTINGS_PAGE_SIZE = 20;

export interface GetAdminMarketListingsResult {
  listings: AdminMarketListingRow[];
  nextOffset: number | null;
}

// Offset pagination, same reasoning as every other admin list (an internal
// tool, not the public feed). Two plain queries + an in-memory join for
// seller name/email (same pattern as admin-submissions.ts) rather than a
// PostgREST embed.
export async function getAdminMarketListings(
  supabase: SupabaseClient<Database>,
  { search, offset = 0, limit = ADMIN_LISTINGS_PAGE_SIZE }: { search?: string; offset?: number; limit?: number } = {}
): Promise<GetAdminMarketListingsResult> {
  let query = supabase
    .from("market_listings")
    .select(LISTING_COLUMNS)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const term = search?.trim();
  if (term) query = query.ilike("title", `%${term}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const sellerIds = [...new Set(rows.map((row) => row.seller_id))];

  const sellerMap = new Map<string, { fullName: string | null; email: string | null }>();
  if (sellerIds.length > 0) {
    const { data: sellers, error: sellersError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", sellerIds);
    if (sellersError) throw sellersError;
    for (const seller of sellers ?? []) {
      sellerMap.set(seller.id, { fullName: seller.full_name, email: seller.email });
    }
  }

  const listings = rows.map((row) => {
    const listing = mapListingRow(row);
    const seller = sellerMap.get(row.seller_id);
    return { ...listing, sellerName: seller?.fullName ?? null, sellerEmail: seller?.email ?? null };
  });

  return { listings, nextOffset: listings.length === limit ? offset + limit : null };
}

export async function getMyMarketListings(supabase: SupabaseClient<Database>, sellerId: string): Promise<MarketListing[]> {
  const { data, error } = await supabase
    .from("market_listings")
    .select(LISTING_COLUMNS)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapListingRow);
}

export interface CreateMarketListingInput {
  sellerId: string;
  title: string;
  description: string | null;
  price: number;
  category: MarketCategory;
  condition: MarketCondition | null;
  images: UploadedImage[];
  contact: string;
}

export async function createMarketListing(
  supabase: SupabaseClient<Database>,
  input: CreateMarketListingInput
): Promise<MarketListing> {
  // is_service is trigger-derived from category server-side -- never sent.
  const { data, error } = await supabase
    .from("market_listings")
    .insert({
      seller_id: input.sellerId,
      title: input.title,
      description: input.description,
      price: input.price,
      category: input.category,
      condition: input.condition,
      images: input.images as unknown as Database["public"]["Tables"]["market_listings"]["Insert"]["images"],
      contact: input.contact,
    })
    .select(LISTING_COLUMNS)
    .single();

  if (error) throw error;
  return mapListingRow(data);
}

export interface UpdateMarketListingInput {
  listingId: string;
  title: string;
  description: string | null;
  price: number;
  category: MarketCategory;
  condition: MarketCondition | null;
  images: UploadedImage[];
  contact: string;
}

export async function updateMarketListing(
  supabase: SupabaseClient<Database>,
  input: UpdateMarketListingInput
): Promise<MarketListing> {
  const { data, error } = await supabase
    .from("market_listings")
    .update({
      title: input.title,
      description: input.description,
      price: input.price,
      category: input.category,
      condition: input.condition,
      images: input.images as unknown as Database["public"]["Tables"]["market_listings"]["Update"]["images"],
      contact: input.contact,
    })
    .eq("id", input.listingId)
    .select(LISTING_COLUMNS)
    .single();

  if (error) throw error;
  return mapListingRow(data);
}

export async function setMarketListingStatus(
  supabase: SupabaseClient<Database>,
  listingId: string,
  status: MarketListingStatus
): Promise<void> {
  const { error } = await supabase.from("market_listings").update({ status }).eq("id", listingId);
  if (error) throw error;
}

// Deletes the row first, then best-effort cleans up Storage -- same order
// as deleteSubmission/deleteHostelAdmin, for the same reason: never block
// an irreversible delete on a slow/flaky Storage call.
export async function deleteMarketListing(supabase: SupabaseClient<Database>, listingId: string): Promise<void> {
  const { data: existing } = await supabase.from("market_listings").select("images").eq("id", listingId).maybeSingle();

  const { error } = await supabase.from("market_listings").delete().eq("id", listingId);
  if (error) throw error;

  if (!existing) return;

  const images = parseUploadedImages(existing.images);
  await Promise.allSettled(
    images.flatMap((img) => [
      deleteImageFromStorage(supabase, "market-images", img.url),
      ...(img.thumbUrl ? [deleteImageFromStorage(supabase, "market-images", img.thumbUrl)] : []),
    ])
  );
}

export async function incrementListingViews(supabase: SupabaseClient<Database>, listingId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_listing_views", { p_listing_id: listingId });
  if (error) throw error;
}

export interface SellerPublicProfile {
  fullName: string | null;
  createdAt: string;
}

// Uses get_seller_public_profile rather than a plain profiles select --
// Session 15 locked profiles' SELECT to self-or-admin, so a stranger
// viewing someone else's listing can't read their profiles row directly.
export async function getSellerPublicProfile(
  supabase: SupabaseClient<Database>,
  sellerId: string
): Promise<SellerPublicProfile | null> {
  const { data, error } = await supabase.rpc("get_seller_public_profile", { p_seller_id: sellerId });
  if (error) throw error;
  const row = data?.[0];
  return row ? { fullName: row.full_name, createdAt: row.created_at } : null;
}

export async function getSellerActiveListingCount(supabase: SupabaseClient<Database>, sellerId: string): Promise<number> {
  const { count, error } = await supabase
    .from("market_listings")
    .select("*", { count: "exact", head: true })
    .eq("seller_id", sellerId)
    .eq("status", "active");
  if (error) throw error;
  return count ?? 0;
}
