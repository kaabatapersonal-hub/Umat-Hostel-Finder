"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createBuzzReply } from "@/lib/queries/buzz";

export function useCreateBuzzReply() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      return createBuzzReply(supabase, { postId, authorId: user.id, content });
    },
    onSuccess: (_reply, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ["buzz-replies", postId] });
      // reply_count is trigger-maintained -- refetch the post to pick up
      // whatever it just recalculated (same reasoning as useSubmitReview
      // refetching a hostel's rating_avg/rating_count).
      queryClient.invalidateQueries({ queryKey: ["buzz-post", postId] });
      queryClient.invalidateQueries({ queryKey: ["buzz-feed"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-pinned"] });
    },
  });
}
