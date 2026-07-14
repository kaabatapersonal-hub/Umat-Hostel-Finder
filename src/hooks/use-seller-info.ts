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
    staleTime: 60_000,
  });
}
