"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getSavedBuzzPosts, type SavedBuzzCursor } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";

// Powers Profile's "Saved Posts" tab -- the current user's own bookmarked
// posts, most recently saved first. Enabled only when signed in and only
// while the caller actually wants it fetched (the Profile page passes
// `enabled: listTab === "buzz"`, same reasoning as useBuzzFeed/
// useHotBuzzFeed's own `enabled` -- no point fetching a tab that isn't
// showing).
export function useSavedBuzzPosts({ enabled = true }: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["saved-buzz-posts", user?.id] as const,
    queryFn: ({ pageParam }) => getSavedBuzzPosts(supabase, user!.id, { cursor: pageParam }),
    initialPageParam: null as SavedBuzzCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && !!user,
  });
}
