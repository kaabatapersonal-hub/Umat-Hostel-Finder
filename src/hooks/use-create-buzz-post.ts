"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createBuzzPost, type GetBuzzFeedResult } from "@/lib/queries/buzz";

// Not truly optimistic (no pre-confirmation insert + rollback) -- the
// mutation is awaited as normal, but on success the real returned row is
// prepended straight into the feed's cache rather than waiting for a
// full refetch, so posting still feels instant without the complexity of
// reconciling a temporary client-side row against the server's real one.
export function useCreateBuzzPost() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      return createBuzzPost(supabase, { authorId: user.id, content });
    },
    onSuccess: (newPost) => {
      queryClient.setQueryData<InfiniteData<GetBuzzFeedResult>>(["buzz-feed"], (old) => {
        if (!old) return old;
        const [firstPage, ...rest] = old.pages;
        return { ...old, pages: [{ ...firstPage, posts: [newPost, ...firstPage.posts] }, ...rest] };
      });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}
