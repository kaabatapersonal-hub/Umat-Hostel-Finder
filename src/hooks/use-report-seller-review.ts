"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { reportSellerReview } from "@/lib/queries/seller-reviews";
import type { GetSellerReviewsResult } from "@/lib/queries/seller-reviews";

export function useReportSellerReview() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: string; sellerId: string }) => reportSellerReview(supabase, reviewId),
    onSuccess: (_void, { reviewId, sellerId }) => {
      queryClient.setQueriesData<{ pages: GetSellerReviewsResult[]; pageParams: number[] } | undefined>(
        { queryKey: ["seller-reviews", sellerId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              reviews: page.reviews.map((review) => (review.id === reviewId ? { ...review, reported: true } : review)),
            })),
          };
        }
      );
    },
  });
}
