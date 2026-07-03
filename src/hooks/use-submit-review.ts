"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createReview, updateReview } from "@/lib/queries/reviews";

export interface SubmitReviewVars {
  hostelId: string;
  existingReviewId?: string;
  rating: number;
  comment: string;
  reviewerName: string | null;
}

export function useSubmitReview() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ hostelId, existingReviewId, rating, comment, reviewerName }: SubmitReviewVars) => {
      // Re-fetch fresh rather than trust context — this can run right after
      // the auth sheet resolves a sign-in, before React necessarily
      // re-renders with the new user (see the identical pattern and
      // reasoning in useToggleSave).
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      if (existingReviewId) {
        return updateReview(supabase, { reviewId: existingReviewId, rating, comment, reviewerName });
      }
      return createReview(supabase, { hostelId, authorId: user.id, rating, comment, reviewerName });
    },
    onSuccess: (_review, { hostelId }) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", hostelId] });
      queryClient.invalidateQueries({ queryKey: ["my-review", hostelId] });
      // The rating_avg/rating_count shown in the header are cached columns
      // on hostels, kept correct by the Session 2 trigger — refetch to pick
      // up whatever it just recalculated.
      queryClient.invalidateQueries({ queryKey: ["hostel", hostelId] });
    },
  });
}
