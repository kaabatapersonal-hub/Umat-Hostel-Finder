"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMyBookmarkedPostIds } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";

// Batched across every post currently on screen, same shape as
// useMyLikedPosts/useVerifiedProfiles -- one query per feed, not one per
// card.
export function useMyBookmarkedPosts(postIds: string[]) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const key = useMemo(() => [...new Set(postIds)].sort(), [postIds]);

  return useQuery({
    queryKey: ["my-bookmarked-posts", key, user?.id] as const,
    queryFn: () => getMyBookmarkedPostIds(supabase, key, user!.id),
    enabled: !!user && key.length > 0,
    staleTime: 30_000,
  });
}
