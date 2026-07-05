"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getBuzzFeed, type BuzzCursor } from "@/lib/queries/buzz";

export function useBuzzFeed() {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["buzz-feed"] as const,
    queryFn: ({ pageParam }) => getBuzzFeed(supabase, { cursor: pageParam }),
    initialPageParam: null as BuzzCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
