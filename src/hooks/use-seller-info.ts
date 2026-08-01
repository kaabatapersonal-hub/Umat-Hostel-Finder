"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getSellerPublicProfile, getSellerActiveListingCount } from "@/lib/queries/market";

export function useSellerInfo(sellerId: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["seller-info", sellerId] as const,
    queryFn: async () => {
      const [profile, activeListingCount] = await Promise.all([
        getSellerPublicProfile(supabase, sellerId),
        getSellerActiveListingCount(supabase, sellerId),
      ]);
      return { profile, activeListingCount };
    },
    // Guards callers that must call this before their own data has loaded
    // yet (hooks can't be conditional) -- e.g. MarketListingDetailView
    // needs the seller's rating before it knows the listing's sellerId.
    enabled: !!sellerId,
    staleTime: 60_000,
  });
}
