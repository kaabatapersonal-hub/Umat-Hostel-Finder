import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface ReportedReviewRow {
  id: string;
  hostelId: string;
  hostelName: string | null;
  rating: number;
  comment: string;
  reviewerName: string | null;
  createdAt: string;
}

// Two plain queries + an in-memory join (same reasoning as
// admin-submissions.ts) rather than a PostgREST embed.
export async function getReportedReviews(supabase: SupabaseClient<Database>): Promise<ReportedReviewRow[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, hostel_id, rating, comment, reviewer_name, created_at")
    .eq("reported", true)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const hostelIds = [...new Set(rows.map((row) => row.hostel_id))];

  const nameMap = new Map<string, string>();
  if (hostelIds.length > 0) {
    const { data: hostels, error: hostelsError } = await supabase.from("hostels").select("id, name").in("id", hostelIds);
    if (hostelsError) throw hostelsError;
    for (const hostel of hostels ?? []) {
      nameMap.set(hostel.id, hostel.name);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    hostelId: row.hostel_id,
    hostelName: nameMap.get(row.hostel_id) ?? null,
    rating: row.rating,
    comment: row.comment,
    reviewerName: row.reviewer_name,
    createdAt: row.created_at,
  }));
}

// Removing the review is allowed for genuinely abusive/fake content --
// the rating trigger (Session 7) recalculates the hostel's rating_avg/
// rating_count automatically.
export async function deleteReviewAdmin(supabase: SupabaseClient<Database>, reviewId: string): Promise<void> {
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  if (error) throw error;
}

// Reports are a flag for triage, not a takedown (Session 7) -- dismissing
// one restores a legitimate review to normal, it never got hidden from
// students in the first place.
export async function dismissReportAdmin(supabase: SupabaseClient<Database>, reviewId: string): Promise<void> {
  const { error } = await supabase.from("reviews").update({ reported: false }).eq("id", reviewId);
  if (error) throw error;
}
