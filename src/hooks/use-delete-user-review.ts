"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteReviewAdmin } from "@/lib/queries/admin-reviews";

// Single-review delete from within a user's detail view -- reuses the
// same underlying write as the Moderation tab's delete action, just with
// invalidation scoped to also refresh this user's detail/list rows.
export function useDeleteUserReview(userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: string; hostelId: string }) => deleteReviewAdmin(supabase, reviewId),
    onSuccess: (_void, { hostelId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reported-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["reviews", hostelId] });
      queryClient.invalidateQueries({ queryKey: ["hostel", hostelId] });
    },
  });
}
