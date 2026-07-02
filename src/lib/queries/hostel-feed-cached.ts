import "server-only";
import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/server";
import { getHostels, HOSTEL_FEED_PAGE_SIZE, type GetHostelsResult } from "./hostels";

// The unfiltered, unsearched, first page of the feed is what nearly every
// visitor sees, so it's the one worth caching hard: shared across all
// requests for 60s instead of hitting Supabase on every page load. Search
// and filters stay fully dynamic (fetched client-side via useHostels).
export const getDefaultHostelFeed = unstable_cache(
  async (): Promise<GetHostelsResult> => {
    const supabase = createStaticClient();
    return getHostels(supabase, { limit: HOSTEL_FEED_PAGE_SIZE });
  },
  ["hostel-feed-default"],
  { revalidate: 60, tags: ["hostels"] }
);
