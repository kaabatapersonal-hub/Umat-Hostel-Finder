"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteBuzzPost } from "@/lib/queries/buzz";

export function useDeleteBuzzPost() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => deleteBuzzPost(supabase, postId),
    onSuccess: (_void, postId) => {
      queryClient.invalidateQueries({ queryKey: ["buzz-feed"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-pinned"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-post", postId] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}
