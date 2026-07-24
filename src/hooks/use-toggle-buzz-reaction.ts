"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toggleBuzzReaction, type BuzzReactionEmoji } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";

// The UI itself handles the optimistic feel with a short-lived local
// override (see reaction-pills.tsx) rather than patching the feed's/
// single-post's/pinned-posts' three independent query caches by hand --
// on settle this just invalidates all of them so the server's true
// counts and the caller's own reaction state flow back in.
export function useToggleBuzzReaction(postId: string) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emoji: BuzzReactionEmoji) => toggleBuzzReaction(supabase, postId, emoji),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["my-post-reactions", postId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["buzz-feed"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-pinned"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-post", postId] });
    },
  });
}
