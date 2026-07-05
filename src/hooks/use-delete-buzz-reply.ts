"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteBuzzReply } from "@/lib/queries/buzz";

export function useDeleteBuzzReply(postId: string) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (replyId: string) => deleteBuzzReply(supabase, replyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buzz-replies", postId] });
      queryClient.invalidateQueries({ queryKey: ["buzz-post", postId] });
      queryClient.invalidateQueries({ queryKey: ["buzz-feed"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-pinned"] });
    },
  });
}
