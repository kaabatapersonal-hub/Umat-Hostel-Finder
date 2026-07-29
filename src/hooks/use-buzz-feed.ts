"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getBuzzFeed, type BuzzCursor } from "@/lib/queries/buzz";

// enabled defaults true but the Buzz page passes false for whichever of
// New/Hot isn't the active tab -- no reason to double the network cost of
// fetching both feeds' first pages when only one is ever on screen at a
// time. Whichever tab the visitor switches to fetches (once) the moment
// it becomes enabled, then stays cached.
export function useBuzzFeed({ enabled = true }: { enabled?: boolean } = {}) {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["buzz-feed"] as const,
    queryFn: ({ pageParam }) => getBuzzFeed(supabase, { cursor: pageParam }),
    initialPageParam: null as BuzzCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}
