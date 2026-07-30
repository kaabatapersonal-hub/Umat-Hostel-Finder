"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getBuzzReplies } from "@/lib/queries/buzz";

// `enabled` defaults true for back-compat, but the reply bottom sheet
// passes `enabled: open` -- no reason to fetch a thread that isn't showing
// yet (same reasoning as useBuzzFeed/useHotBuzzFeed's own `enabled`).
export function useBuzzReplies(postId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["buzz-replies", postId] as const,
    queryFn: ({ pageParam }) => getBuzzReplies(supabase, postId, { offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: enabled && !!postId,
  });
}
