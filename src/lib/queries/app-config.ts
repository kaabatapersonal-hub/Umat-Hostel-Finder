import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Plain per-request read, deliberately uncached -- app_config rows are a
// single cheap primary-key lookup, and this specifically gates whether the
// marketplace is visible at all, so it needs to reflect a flip the moment
// it happens rather than lag behind a cache TTL.
export async function getAppConfigBoolean(
  supabase: SupabaseClient<Database>,
  key: string,
  defaultValue: boolean
): Promise<boolean> {
  const { data, error } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();

  if (error || !data) return defaultValue;
  return typeof data.value === "boolean" ? data.value : defaultValue;
}
