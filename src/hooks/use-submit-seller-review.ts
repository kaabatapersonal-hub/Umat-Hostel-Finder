"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createSellerReview, updateSellerReview } from "@/lib/queries/seller-reviews";
import { playSound } from "@/lib/sounds";

export interface SubmitSellerReviewVars {
  sellerId: string;
  existingReviewId?: string;
  rating: number;
  comment: string;
  reviewerName: string | null;
}

export function useSubmitSellerReview() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sellerId, existingReviewId, rating, comment, reviewerName }: SubmitSellerReviewVars) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      if (existingReviewId) {
        return updateSellerReview(supabase, { reviewId: existingReviewId, rating, comment, reviewerName });
      }
      return createSellerReview(supabase, { sellerId, authorId: user.id, rating, comment, reviewerName });
    },
    onSuccess: (_review, { sellerId }) => {
      playSound("success");
      queryClient.invalidateQueries({ queryKey: ["seller-reviews", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["my-seller-review", sellerId] });
      // seller_rating_avg/count are cached columns on profiles, kept
      // correct by the recalculate_seller_rating trigger.
      queryClient.invalidateQueries({ queryKey: ["seller-info", sellerId] });
    },
  });
}
