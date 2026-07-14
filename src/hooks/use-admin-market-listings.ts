"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminMarketListings } from "@/lib/queries/market";

export function useAdminMarketListings(search: string) {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["admin-market-listings", search] as const,
    queryFn: ({ pageParam }) => getAdminMarketListings(supabase, { search, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}
