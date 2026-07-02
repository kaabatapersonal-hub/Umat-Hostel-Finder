import "server-only";
import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/server";
import { getHostelById, type HostelDetails } from "./hostels";

// Per-id ISR cache for the details page, mirroring the feed's
// hostel-feed-cached.ts. A fresh unstable_cache-wrapped closure is created
// per call (id captured via closure), but the cache entry itself is keyed by
// the explicit ["hostel-details", id] key part — not by function identity —
// so this correctly hits the same persisted cache across requests. This is
// the pattern Next's own docs use for parameterized unstable_cache.
export function getCachedHostelById(id: string): Promise<HostelDetails | null> {
  return unstable_cache(
    async () => {
      const supabase = createStaticClient();
      return getHostelById(supabase, id);
    },
    ["hostel-details", id],
    { revalidate: 60, tags: ["hostels", `hostel-${id}`] }
  )();
}
