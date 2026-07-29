"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { reportBuzzItem, type BuzzReportReason } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/components/ui/toast";
import { captureEvent } from "@/lib/analytics";

export function useReportBuzzItem() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({
      postId,
      replyId,
      reason,
      details,
    }: {
      postId?: string | null;
      replyId?: string | null;
      reason: BuzzReportReason;
      details?: string | null;
    }) => {
      if (!user) throw new Error("Not signed in");
      await reportBuzzItem(supabase, { reporterId: user.id, postId, replyId, reason, details });
    },
    onSuccess: (_void, { postId, replyId }) => {
      queryClient.invalidateQueries({ queryKey: ["my-buzz-reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin-buzz-reports"] });
      queryClient.invalidateQueries({ queryKey: ["pending-buzz-reports-count"] });
      captureEvent("reported_buzz_item", { post_id: postId ?? null, reply_id: replyId ?? null });
      showToast({ message: "Report submitted — we'll review it.", variant: "success" });
    },
    onError: () => {
      showToast({ message: "Couldn't submit your report — try again?", variant: "error" });
    },
  });
}
