"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMarketFeed, type MarketCursor, type MarketFeedFilters } from "@/lib/queries/market";

export function useMarketFeed({ search, filters }: { search: string; filters: MarketFeedFilters }) {
  const supabase = useMemo(() => createClient(), []);
  const trimmedSearch = search.trim();

  return useInfiniteQuery({
    queryKey: ["market-feed", trimmedSearch, filters] as const,
    queryFn: ({ pageParam }) => getMarketFeed(supabase, { search: trimmedSearch, filters, cursor: pageParam }),
    initialPageParam: null as MarketCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: 2,
  });
}
