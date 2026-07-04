"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { rejectSubmission } from "@/lib/queries/admin-submissions";

export function useRejectSubmission() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ submissionId, adminNote }: { submissionId: string; adminNote: string | null }) => {
      await rejectSubmission(supabase, submissionId, adminNote);

      // Best-effort, same reasoning as approval's notify call.
      fetch("/api/admin/submission-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, action: "rejected", adminNote }),
      }).catch(() => {});
    },
    onSuccess: (_void, { submissionId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
    },
  });
}
