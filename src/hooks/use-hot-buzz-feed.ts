"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getHotBuzzFeed, type HotBuzzCursor } from "@/lib/queries/buzz";

// See useBuzzFeed's own comment on `enabled` -- same reasoning, the Buzz
// page only ever wants one of New/Hot actually fetching at a time.
export function useHotBuzzFeed({ enabled = true }: { enabled?: boolean } = {}) {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["buzz-feed-hot"] as const,
    queryFn: ({ pageParam }) => getHotBuzzFeed(supabase, { cursor: pageParam }),
    initialPageParam: null as HotBuzzCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}
