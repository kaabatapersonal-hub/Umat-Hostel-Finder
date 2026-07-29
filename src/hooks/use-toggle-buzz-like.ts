"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { likeBuzzPost, unlikeBuzzPost } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";

// The UI itself handles the optimistic feel with a short-lived local
// override (see like-button.tsx) rather than patching the feed's/hot
// feed's/pinned-posts'/single-post's four independent query caches by
// hand -- on settle this just invalidates all of them so the server's
// true count and the caller's own liked state flow back in. Same posture
// as the 5-emoji reaction system this replaces.
export function useToggleBuzzLike(postId: string) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nextLiked: boolean) => {
      if (!user) throw new Error("Not signed in");
      if (nextLiked) {
        await likeBuzzPost(supabase, postId, user.id);
      } else {
        await unlikeBuzzPost(supabase, postId, user.id);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["my-liked-posts"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-feed"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-feed-hot"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-pinned"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-post", postId] });
    },
  });
}
