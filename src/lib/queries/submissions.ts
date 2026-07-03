import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

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
