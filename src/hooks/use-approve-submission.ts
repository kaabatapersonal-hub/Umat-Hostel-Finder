"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { approveSubmission } from "@/lib/queries/admin-submissions";

export function useApproveSubmission() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { hostelId } = await approveSubmission(supabase, submissionId);

      // Best-effort notification -- approve_submission already committed
      // by this point (it's a single atomic RPC call), so a slow/failed
      // email must never read as a failure of the approval itself.
      fetch("/api/admin/submission-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, action: "approved", hostelId }),
      }).catch(() => {});

      return { hostelId };
    },
    onSuccess: (_data, submissionId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-hostels"] });
      queryClient.invalidateQueries({ queryKey: ["hostels"] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
    },
  });
}
