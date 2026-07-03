import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { parseRoomTypes, type RoomTypeEntry } from "@/lib/room-types";
import { parseUploadedImages, type UploadedImage } from "@/lib/images";
import { deleteImageFromStorage } from "@/lib/storage-upload";
import type { EditableHostelFields } from "@/lib/hostel-fields";

export interface AdminHostelRow {
  id: string;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  location: string;
  availability: string;
  thumbnail: UploadedImage | null;
  featured: boolean;
  featuredUntil: string | null;
  isPaid: boolean;
  ratingAvg: number;
  ratingCount: number;
  hasPendingEdit: boolean;
  hasCoordinates: boolean;
}

const ADMIN_LIST_PAGE_SIZE = 20;

export interface GetAdminHostelsResult {
  hostels: AdminHostelRow[];
  nextOffset: number | null;
}

// Offset pagination, same pattern as Session 7's reviews list -- this is an
// internal tool, not the public feed, and admin hostel counts stay in the
// dozens/low-hundreds range for a long time.
export async function getAdminHostels(
  supabase: SupabaseClient<Database>,
  { offset = 0, limit = ADMIN_LIST_PAGE_SIZE }: { offset?: number; limit?: number } = {}
): Promise<GetAdminHostelsResult> {
  const { data, error } = await supabase
    .from("hostels")
    .select(
      "id, name, price_min, price_max, location, availability, images, featured, featured_until, is_paid, rating_avg, rating_count, has_pending_edit, latitude, longitude"
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const hostels: AdminHostelRow[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    priceMin: row.price_min,
    priceMax: row.price_max,
    location: row.location,
    availability: row.availability,
    thumbnail: parseUploadedImages(row.images)[0] ?? null,
    featured: row.featured,
    featuredUntil: row.featured_until,
    isPaid: row.is_paid,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    hasPendingEdit: row.has_pending_edit,
    hasCoordinates: row.latitude != null && row.longitude != null,
  }));

  return { hostels, nextOffset: hostels.length === limit ? offset + limit : null };
}

export interface AdminHostelDetail extends EditableHostelFields {
  id: string;
  availability: string;
  featured: boolean;
  featuredUntil: string | null;
  isPaid: boolean;
}

const ADMIN_HOSTEL_DETAIL_COLUMNS =
  "id, name, location, distance_text, description, room_types, images, facilities, contact, call_number, latitude, longitude, tags, availability, featured, featured_until, is_paid";

export async function getAdminHostelDetail(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<AdminHostelDetail | null> {
  const { data, error } = await supabase.from("hostels").select(ADMIN_HOSTEL_DETAIL_COLUMNS).eq("id", id).maybeSingle();

  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    location: data.location,
    distanceText: data.distance_text,
    description: data.description,
    roomTypes: parseRoomTypes(data.room_types),
    images: parseUploadedImages(data.images),
    facilities: data.facilities ?? [],
    contact: data.contact,
    callNumber: data.call_number,
    latitude: data.latitude,
    longitude: data.longitude,
    tags: data.tags ?? [],
    availability: data.availability,
    featured: data.featured,
    featuredUntil: data.featured_until,
    isPaid: data.is_paid,
  };
}

function toHostelRow(fields: EditableHostelFields) {
  return {
    name: fields.name,
    location: fields.location,
    distance_text: fields.distanceText,
    description: fields.description,
    room_types: fields.roomTypes as unknown as Json,
    images: fields.images as unknown as Json,
    facilities: fields.facilities,
    contact: fields.contact,
    call_number: fields.callNumber,
    latitude: fields.latitude,
    longitude: fields.longitude,
    tags: fields.tags,
  };
}

// Admin creates go straight into hostels, live immediately -- no
// submissions queue, no pending buffer (admin already has full RLS
// rights). owner_id is left null; a manager can claim it later (V2).
export async function createHostelAdmin(
  supabase: SupabaseClient<Database>,
  fields: EditableHostelFields
): Promise<{ id: string }> {
  const { data, error } = await supabase.from("hostels").insert(toHostelRow(fields)).select("id").single();
  if (error) throw error;
  return { id: data.id };
}

// Writes directly to the live columns -- unlike an owner's edit request
// (Session 8.5's pending_changes buffer), admin's own edits don't need
// approval. Image cleanup-on-edit comes for free here: the reused
// ImageUploader already deletes a removed image from Storage the moment
// it's removed from the form (Session 8's fix), regardless of who's
// editing.
export async function updateHostelAdmin(
  supabase: SupabaseClient<Database>,
  id: string,
  fields: EditableHostelFields
): Promise<void> {
  const { error } = await supabase.from("hostels").update(toHostelRow(fields)).eq("id", id);
  if (error) throw error;
}

export async function setHostelAvailability(
  supabase: SupabaseClient<Database>,
  id: string,
  availability: string
): Promise<void> {
  const { error } = await supabase.from("hostels").update({ availability }).eq("id", id);
  if (error) throw error;
}

export interface FeaturedUpdate {
  featured: boolean;
  featuredUntil: string | null;
  isPaid: boolean;
}

export async function setHostelFeatured(
  supabase: SupabaseClient<Database>,
  id: string,
  update: FeaturedUpdate
): Promise<void> {
  const { error } = await supabase
    .from("hostels")
    .update({ featured: update.featured, featured_until: update.featuredUntil, is_paid: update.isPaid })
    .eq("id", id);
  if (error) throw error;
}

// Deleting a hostel cascades reviews and saved_hostels rows at the DB level
// (Session 2/7's foreign keys), but Storage objects aren't touched by a
// cascade -- fetch every image URL first, delete the row, then best-effort
// clean up Storage (same "row first, cleanup after" order as Session 8.5's
// deleteSubmission, for the same reason: never block an irreversible
// delete on a slow/flaky Storage call).
export async function deleteHostelAdmin(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  const { data: existing } = await supabase.from("hostels").select("images, room_types").eq("id", id).maybeSingle();

  const { error } = await supabase.from("hostels").delete().eq("id", id);
  if (error) throw error;

  if (!existing) return;

  const generalImages = parseUploadedImages(existing.images);
  const roomTypeImages = parseRoomTypes(existing.room_types).flatMap((rt: RoomTypeEntry) => rt.images);

  await Promise.allSettled([
    ...generalImages.map((img) => deleteImageFromStorage(supabase, "hostel-images", img.url)),
    ...roomTypeImages.map((img) => deleteImageFromStorage(supabase, "room-images", img.url)),
  ]);
}
