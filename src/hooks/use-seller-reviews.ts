"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getReviewsForSeller, SELLER_REVIEWS_PAGE_SIZE } from "@/lib/queries/seller-reviews";

export function useSellerReviews(sellerId: string) {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["seller-reviews", sellerId] as const,
    queryFn: ({ pageParam }) => getReviewsForSeller(supabase, sellerId, { offset: pageParam, limit: SELLER_REVIEWS_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 30_000,
  });
}
