import { Suspense } from "react";
import { getDefaultHostelFeed } from "@/lib/queries/hostel-feed-cached";
import { HomeFeed } from "@/components/hostels/home-feed";
import type { GetHostelsResult } from "@/lib/queries/hostels";

// The unfiltered feed is cached (unstable_cache, revalidate: 60) in
// lib/queries/hostel-feed-cached.ts, so this page can be statically
// generated and revalidated on the same cadence — most loads never hit
// Supabase. Search and filters take over client-side once the user types.
export const revalidate = 60;

export default async function HomePage() {
  let initialData: GetHostelsResult | undefined;
  try {
    initialData = await getDefaultHostelFeed();
  } catch {
    // Don't fail the whole page if Supabase is unreachable at build/request
    // time — leave initialData undefined so the client performs its own
    // fetch and shows the real loading/error state instead of a page crash.
    initialData = undefined;
  }

  // useHostelFilters (Session 9.5) reads the URL via useSearchParams, which
  // Next.js requires a Suspense boundary for -- this keeps that dynamic
  // requirement scoped to HomeFeed rather than de-opting the whole ISR page.
  return (
    <Suspense fallback={null}>
      <HomeFeed initialData={initialData} />
    </Suspense>
  );
}
