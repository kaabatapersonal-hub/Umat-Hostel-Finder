import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { EditableHostelFields } from "@/lib/hostel-fields";
import { parseRoomTypes } from "@/lib/room-types";
import { parseUploadedImages } from "@/lib/images";
import { deleteImageFromStorage } from "@/lib/storage-upload";

export interface SubmissionSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  adminNote: string | null;
}

// Submissions are created by the Session 8 form — this just reads whatever
// exists for the current user (nothing, until then).
export async function getMySubmissions(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<SubmissionSummary[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("id, name, status, created_at, admin_note")
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    adminNote: row.admin_note,
  }));
}

export interface CreateSubmissionInput extends EditableHostelFields {
  submittedBy: string;
}

function toSubmissionRow(input: EditableHostelFields) {
  return {
    name: input.name,
    location: input.location,
    distance_text: input.distanceText,
    description: input.description,
    room_types: input.roomTypes as unknown as Json,
    images: input.images as unknown as Json,
    facilities: input.facilities,
    contact: input.contact,
    call_number: input.callNumber,
    latitude: input.latitude,
    longitude: input.longitude,
    tags: input.tags,
  };
}

// Shares hostels' field shapes on purpose (room_types, images-as-objects,
// price_min/price_max maintained by the same trigger) so Session 11's
// admin approval can copy a submission straight into a new hostels row.
export async function createSubmission(
  supabase: SupabaseClient<Database>,
  input: CreateSubmissionInput
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("submissions")
    .insert({ submitted_by: input.submittedBy, ...toSubmissionRow(input) })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}

export interface SubmissionForEdit extends EditableHostelFields {
  id: string;
  status: string;
}

const SUBMISSION_EDIT_COLUMNS =
  "id, name, location, distance_text, description, room_types, images, facilities, contact, call_number, latitude, longitude, tags, status";

// Pre-fills the Submit form when a user reopens their own pending
// submission to edit it. RLS (submissions_select_own_or_admin) already
// makes sure a stranger's id here just returns null, not someone else's
// data.
export async function getSubmissionForEdit(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<SubmissionForEdit | null> {
  const { data, error } = await supabase.from("submissions").select(SUBMISSION_EDIT_COLUMNS).eq("id", id).maybeSingle();

  if (error) throw error;
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
    status: data.status,
  };
}

export interface UpdateSubmissionInput extends EditableHostelFields {
  id: string;
}

// RLS (submissions_update_own_pending) is the real enforcement here: this
// only succeeds while the row is still the caller's own AND still
// 'pending' -- an approved/rejected submission or someone else's silently
// updates zero rows rather than raising, so the caller should treat "no
// error but nothing changed" as a possibility (the UI never offers Edit
// on a non-pending submission in the first place).
export async function updateSubmission(supabase: SupabaseClient<Database>, input: UpdateSubmissionInput): Promise<void> {
  const { error } = await supabase.from("submissions").update(toSubmissionRow(input)).eq("id", input.id);
  if (error) throw error;
}

// Withdraws a pending submission and best-effort cleans up every image it
// referenced (general photos + every room type's photos) -- unlike the
// Session 8 single-image remove fix, this is a whole-record teardown, so
// it has to walk both places images can live. The row is deleted first;
// image cleanup is best-effort afterward so a slow/failed Storage delete
// never blocks the withdrawal itself (same "acceptable orphan" tradeoff as
// the abandoned-mid-form case).
export async function deleteSubmission(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  const { data: existing } = await supabase.from("submissions").select("images, room_types").eq("id", id).maybeSingle();

  const { error } = await supabase.from("submissions").delete().eq("id", id);
  if (error) throw error;

  if (!existing) return;

  const generalImages = parseUploadedImages(existing.images);
  const roomTypeImages = parseRoomTypes(existing.room_types).flatMap((rt) => rt.images);

  await Promise.allSettled([
    ...generalImages.map((img) => deleteImageFromStorage(supabase, "hostel-images", img.url)),
    ...roomTypeImages.map((img) => deleteImageFromStorage(supabase, "room-images", img.url)),
  ]);
}
