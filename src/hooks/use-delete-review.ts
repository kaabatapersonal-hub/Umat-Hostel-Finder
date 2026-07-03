"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteReview } from "@/lib/queries/reviews";

export function useDeleteReview() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: string; hostelId: string }) => deleteReview(supabase, reviewId),
    onSuccess: (_void, { hostelId }) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", hostelId] });
      queryClient.invalidateQueries({ queryKey: ["my-review", hostelId] });
      queryClient.invalidateQueries({ queryKey: ["hostel", hostelId] });
    },
  });
}
