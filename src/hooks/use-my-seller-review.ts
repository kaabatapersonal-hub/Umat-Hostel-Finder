"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMyReviewForSeller } from "@/lib/queries/seller-reviews";
import { useAuth } from "@/providers/auth-provider";

export function useMySellerReview(sellerId: string) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["my-seller-review", sellerId, user?.id] as const,
    queryFn: () => getMyReviewForSeller(supabase, sellerId, user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
}
