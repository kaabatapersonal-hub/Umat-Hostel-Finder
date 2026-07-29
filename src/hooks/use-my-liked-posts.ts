"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMyLikedPostIds } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";

// Batched across every post currently on screen, same shape as
// useVerifiedProfiles -- one query per feed, not one per card the way
// the old per-post useMyPostReactions worked.
export function useMyLikedPosts(postIds: string[]) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const key = useMemo(() => [...new Set(postIds)].sort(), [postIds]);

  return useQuery({
    queryKey: ["my-liked-posts", key, user?.id] as const,
    queryFn: () => getMyLikedPostIds(supabase, key, user!.id),
    enabled: !!user && key.length > 0,
    staleTime: 30_000,
  });
}
