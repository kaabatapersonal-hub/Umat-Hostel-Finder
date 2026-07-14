"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getRelatedMarketListings } from "@/lib/queries/market";

export interface UseRelatedMarketListingsOptions {
  listingId: string;
  category: string;
  price: number;
  limit?: number;
  // Gate on IntersectionObserver (use-in-view.ts) -- same lazy-load
  // reasoning as related hostels, just one shared "More items" section
  // here instead of a separate desktop-sidebar/mobile-feed split (the
  // grid is already responsive via the masonry column count).
  enabled: boolean;
}

export function useRelatedMarketListings({ listingId, category, price, limit = 10, enabled }: UseRelatedMarketListingsOptions) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["related-market-listings", listingId, limit],
    queryFn: () => getRelatedMarketListings(supabase, { excludeId: listingId, category, price, limit }),
    enabled,
    staleTime: 5 * 60_000,
  });
}
