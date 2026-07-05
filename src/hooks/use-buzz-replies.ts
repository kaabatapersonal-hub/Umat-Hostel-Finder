"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getBuzzReplies } from "@/lib/queries/buzz";

export function useBuzzReplies(postId: string) {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["buzz-replies", postId] as const,
    queryFn: ({ pageParam }) => getBuzzReplies(supabase, postId, { offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}
