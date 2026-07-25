import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// id -> verification_label (null if verified with no label set). Absence
// from the map means "not verified" -- get_verified_profiles only ever
// returns rows for is_verified = true, so the caller never has to check
// a separate boolean.
export type VerifiedProfileMap = Map<string, string | null>;

// Batch, public (anon-callable) lookup -- one call per rendered list
// (a Buzz page, a hostel's reviews, ...) for every distinct author id on
// screen, not one call per row. See the migration's own comment on why
// this is a live lookup rather than something denormalized onto each
// post/reply/review at write time.
export async function getVerifiedProfiles(supabase: SupabaseClient<Database>, userIds: string[]): Promise<VerifiedProfileMap> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("get_verified_profiles", { p_user_ids: uniqueIds });
  if (error) throw error;

  return new Map((data ?? []).map((row) => [row.id, row.verification_label]));
}
