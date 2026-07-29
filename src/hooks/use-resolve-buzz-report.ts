"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { resolveBuzzReport } from "@/lib/queries/buzz";

export function useResolveBuzzReport() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, action }: { reportId: string; action: "dismiss" | "delete" }) =>
      resolveBuzzReport(supabase, reportId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-buzz-reports"] });
      queryClient.invalidateQueries({ queryKey: ["pending-buzz-reports-count"] });
      // A "delete" action removes real content -- reconcile every surface
      // that could have shown it, same invalidation set useDeleteBuzzPost/
      // useDeleteBuzzReply already use.
      queryClient.invalidateQueries({ queryKey: ["buzz-feed"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-feed-hot"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-pinned"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-post"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-replies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}
