"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { bookmarkBuzzPost, unbookmarkBuzzPost } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";

// Same shape as useToggleBuzzLike -- the UI handles the optimistic feel
// with a short-lived local override (see bookmark-button.tsx) rather than
// patching every cache this card's data could have come from (feed, hot
// feed, pinned, single post, and now the Profile saved-posts list too);
// on settle this just invalidates all of them.
export function useToggleBuzzBookmark(postId: string) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nextBookmarked: boolean) => {
      if (!user) throw new Error("Not signed in");
      if (nextBookmarked) {
        await bookmarkBuzzPost(supabase, postId, user.id);
      } else {
        await unbookmarkBuzzPost(supabase, postId, user.id);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookmarked-posts"] });
      queryClient.invalidateQueries({ queryKey: ["saved-buzz-posts"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-feed"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-feed-hot"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-pinned"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-post", postId] });
    },
  });
}
