"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { dismissReportAdmin } from "@/lib/queries/admin-reviews";

export function useDismissReportAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: string; hostelId: string }) => dismissReportAdmin(supabase, reviewId),
    onSuccess: (_void, { hostelId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-reported-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["reviews", hostelId] });
    },
  });
}
