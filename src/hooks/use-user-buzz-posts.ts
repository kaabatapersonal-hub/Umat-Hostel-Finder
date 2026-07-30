"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getUserBuzzPosts, type BuzzCursor } from "@/lib/queries/buzz";

// Powers a profile page's own "Posts" section. `includeAnonymous` is only
// ever true when the viewer is looking at their own profile (see
// public-profile-view.tsx) -- everyone else only sees this user's
// non-anonymous posts, matching how those same posts already render
// "Student"/no-link everywhere else in the app.
export function useUserBuzzPosts(userId: string, { includeAnonymous = false }: { includeAnonymous?: boolean } = {}) {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["user-buzz-posts", userId, includeAnonymous] as const,
    queryFn: ({ pageParam }) => getUserBuzzPosts(supabase, userId, { includeAnonymous, cursor: pageParam }),
    initialPageParam: null as BuzzCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!userId,
  });
}
