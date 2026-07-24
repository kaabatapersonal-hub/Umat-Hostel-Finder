"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMyReactionsForPost } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";

// Keyed by user id (not just postId) so a different account signing in on
// the same device never sees a stale cache of someone else's reactions.
export function useMyPostReactions(postId: string) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["my-post-reactions", postId, user?.id] as const,
    queryFn: () => getMyReactionsForPost(supabase, postId, user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
}
