"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteSellerReview } from "@/lib/queries/seller-reviews";

export function useDeleteSellerReview() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: string; sellerId: string }) => deleteSellerReview(supabase, reviewId),
    onSuccess: (_void, { sellerId }) => {
      queryClient.invalidateQueries({ queryKey: ["seller-reviews", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["my-seller-review", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["seller-info", sellerId] });
    },
  });
}
