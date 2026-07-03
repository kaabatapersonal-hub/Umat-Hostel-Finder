"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getReviewsForHostel, REVIEWS_PAGE_SIZE } from "@/lib/queries/reviews";

export function useReviews(hostelId: string) {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["reviews", hostelId] as const,
    queryFn: ({ pageParam }) => getReviewsForHostel(supabase, hostelId, { offset: pageParam, limit: REVIEWS_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 30_000,
  });
}
