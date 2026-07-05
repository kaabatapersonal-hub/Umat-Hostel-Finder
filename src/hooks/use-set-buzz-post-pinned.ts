"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { setBuzzPostPinned } from "@/lib/queries/buzz";

export function useSetBuzzPostPinned() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, pinned }: { postId: string; pinned: boolean }) => setBuzzPostPinned(supabase, postId, pinned),
    onSuccess: (_void, { postId }) => {
      // The pin cap trigger may have unpinned other posts too -- invalidate
      // broadly rather than trying to patch the cache precisely.
      queryClient.invalidateQueries({ queryKey: ["buzz-feed"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-pinned"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-post", postId] });
    },
  });
}
