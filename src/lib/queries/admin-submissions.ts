import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { parseRoomTypes } from "@/lib/room-types";
import { parseUploadedImages, type UploadedImage } from "@/lib/images";
import type { EditableHostelFields } from "@/lib/hostel-fields";

export interface AdminSubmissionRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  submittedBy: string;
  submitterName: string | null;
  submitterEmail: string | null;
  thumbnail: UploadedImage | null;
  priceMin: number | null;
  priceMax: number | null;
}

// Two plain queries + an in-memory join, rather than a PostgREST embed --
// this hand-maintained Database type doesn't model relationship metadata
// the way a codegen'd one would, so embedding syntax isn't reliably typed
// here. Submission volume is small enough that this is cheap.
export async function getAdminSubmissions(
  supabase: SupabaseClient<Database>,
  { status }: { status?: string } = {}
): Promise<AdminSubmissionRow[]> {
  let query = supabase
    .from("submissions")
    .select("id, name, status, created_at, submitted_by, images, price_min, price_max")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const submitterIds = [...new Set(rows.map((row) => row.submitted_by))];

  const profileMap = new Map<string, { fullName: string | null; email: string | null }>();
  if (submitterIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", submitterIds);
    if (profilesError) throw profilesError;
    for (const profile of profiles ?? []) {
      profileMap.set(profile.id, { fullName: profile.full_name, email: profile.email });
    }
  }

  return rows.map((row) => {
    const profile = profileMap.get(row.submitted_by);
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      createdAt: row.created_at,
      submittedBy: row.submitted_by,
      submitterName: profile?.fullName ?? null,
      submitterEmail: profile?.email ?? null,
      thumbnail: parseUploadedImages(row.images)[0] ?? null,
      priceMin: row.price_min,
      priceMax: row.price_max,
    };
  });
}

export interface AdminSubmissionDetail extends EditableHostelFields {
  id: string;
  status: string;
  createdAt: string;
  submittedBy: string;
  submitterName: string | null;
  submitterEmail: string | null;
  adminNote: string | null;
}

const ADMIN_SUBMISSION_DETAIL_COLUMNS =
  "id, name, location, distance_text, description, room_types, images, facilities, contact, call_number, latitude, longitude, tags, status, created_at, submitted_by, admin_note";

export async function getAdminSubmissionDetail(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<AdminSubmissionDetail | null> {
  const { data, error } = await supabase.from("submissions").select(ADMIN_SUBMISSION_DETAIL_COLUMNS).eq("id", id).maybeSingle();

  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", data.submitted_by).maybeSingle();

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
    createdAt: data.created_at,
    submittedBy: data.submitted_by,
    submitterName: profile?.full_name ?? null,
    submitterEmail: profile?.email ?? null,
    adminNote: data.admin_note,
  };
}

export async function approveSubmission(supabase: SupabaseClient<Database>, submissionId: string): Promise<{ hostelId: string }> {
  const { data, error } = await supabase.rpc("approve_submission", { p_submission_id: submissionId });
  if (error) throw error;
  return { hostelId: data };
}

export async function rejectSubmission(
  supabase: SupabaseClient<Database>,
  submissionId: string,
  adminNote: string | null
): Promise<void> {
  const { error } = await supabase.rpc("reject_submission", { p_submission_id: submissionId, p_admin_note: adminNote });
  if (error) throw error;
}
