import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { RoomTypeEntry } from "@/lib/room-types";
import type { UploadedImage } from "@/lib/images";

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

export interface CreateSubmissionInput {
  submittedBy: string;
  name: string;
  location: string;
  distanceText: string | null;
  description: string | null;
  roomTypes: RoomTypeEntry[];
  images: UploadedImage[];
  facilities: string[];
  contact: string;
  callNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
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
    .insert({
      submitted_by: input.submittedBy,
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
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}
