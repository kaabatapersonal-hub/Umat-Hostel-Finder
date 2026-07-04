import "server-only";
import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/server";
import { getLandingStats, type LandingStats } from "./landing-stats";

// A vanity counter is exactly the kind of thing that shouldn't cost a
// fresh Supabase round-trip per visitor -- hourly is plenty fresh for
// numbers that move slowly, and keeps the landing page statically
// generated rather than dynamic-per-request.
export const getCachedLandingStats = unstable_cache(
  async (): Promise<LandingStats> => {
    const supabase = createStaticClient();
    return getLandingStats(supabase);
  },
  ["landing-stats"],
  { revalidate: 3600, tags: ["hostels", "reviews"] }
);
