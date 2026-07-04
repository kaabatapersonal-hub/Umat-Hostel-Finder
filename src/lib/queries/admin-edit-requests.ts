import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { parseRoomTypes } from "@/lib/room-types";
import { parseUploadedImages } from "@/lib/images";
import type { EditableHostelFields } from "@/lib/hostel-fields";

export interface EditRequestRow {
  id: string;
  live: EditableHostelFields;
  // Only the keys the owner actually proposed changing -- see
  // parsePendingChanges below. Undefined means "not part of this request,"
  // distinct from null (an explicit clear, e.g. removing the call number).
  pending: Partial<EditableHostelFields>;
}

// pending_changes is a plain jsonb blob (Session 8.5's submit_pending_edit
// stores the full proposed record using hostels' own snake_case column
// names) -- this is the read-side counterpart that turns it back into
// EditableHostelFields shape for display/diffing.
function parsePendingChanges(json: unknown): Partial<EditableHostelFields> {
  if (!json || typeof json !== "object") return {};
  const obj = json as Record<string, unknown>;
  const result: Partial<EditableHostelFields> = {};

  if (typeof obj.name === "string") result.name = obj.name;
  if (typeof obj.location === "string") result.location = obj.location;
  if (obj.distance_text === null || typeof obj.distance_text === "string") result.distanceText = obj.distance_text as string | null;
  if (obj.description === null || typeof obj.description === "string") result.description = obj.description as string | null;
  if (Array.isArray(obj.room_types)) result.roomTypes = parseRoomTypes(obj.room_types);
  if (Array.isArray(obj.images)) result.images = parseUploadedImages(obj.images);
  if (Array.isArray(obj.facilities)) result.facilities = obj.facilities as string[];
  if (typeof obj.contact === "string") result.contact = obj.contact;
  if (obj.call_number === null || typeof obj.call_number === "string") result.callNumber = obj.call_number as string | null;
  if (obj.latitude === null || typeof obj.latitude === "number") result.latitude = obj.latitude as number | null;
  if (obj.longitude === null || typeof obj.longitude === "number") result.longitude = obj.longitude as number | null;
  if (Array.isArray(obj.tags)) result.tags = obj.tags as string[];

  return result;
}

const EDIT_REQUEST_COLUMNS =
  "id, name, location, distance_text, description, room_types, images, facilities, contact, call_number, latitude, longitude, tags, pending_changes";

export async function getHostelsWithPendingEdits(supabase: SupabaseClient<Database>): Promise<EditRequestRow[]> {
  const { data, error } = await supabase.from("hostels").select(EDIT_REQUEST_COLUMNS).eq("has_pending_edit", true);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    live: {
      name: row.name,
      location: row.location,
      distanceText: row.distance_text,
      description: row.description,
      roomTypes: parseRoomTypes(row.room_types),
      images: parseUploadedImages(row.images),
      facilities: row.facilities ?? [],
      contact: row.contact,
      callNumber: row.call_number,
      latitude: row.latitude,
      longitude: row.longitude,
      tags: row.tags ?? [],
    },
    pending: parsePendingChanges(row.pending_changes),
  }));
}

export async function applyPendingEditAdmin(supabase: SupabaseClient<Database>, hostelId: string): Promise<void> {
  const { error } = await supabase.rpc("apply_pending_changes", { p_hostel_id: hostelId });
  if (error) throw error;
}

// Clears the buffer without touching the live columns -- the owner's
// proposal is dropped, their live listing is untouched. Admin already has
// full UPDATE rights on hostels (hostels_update_admin), so this is a plain
// update, no RPC needed.
export async function discardPendingEditAdmin(supabase: SupabaseClient<Database>, hostelId: string): Promise<void> {
  const { error } = await supabase.from("hostels").update({ pending_changes: null, has_pending_edit: false }).eq("id", hostelId);
  if (error) throw error;
}
