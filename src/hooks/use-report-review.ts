"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { reportReview } from "@/lib/queries/reviews";
import type { GetReviewsResult } from "@/lib/queries/reviews";

export function useReportReview() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: string; hostelId: string }) => reportReview(supabase, reviewId),
    onSuccess: (_void, { reviewId, hostelId }) => {
      // No auto-hide on report (a report is a flag for admin triage, not a
      // takedown) — just reflect the flag locally so the UI can show "Reported".
      queryClient.setQueriesData<{ pages: GetReviewsResult[]; pageParams: number[] } | undefined>(
        { queryKey: ["reviews", hostelId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              reviews: page.reviews.map((review) =>
                review.id === reviewId ? { ...review, reported: true } : review
              ),
            })),
          };
        }
      );
    },
  });
}
