"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getSellerActiveListings } from "@/lib/queries/market";

// Backs /market/seller/[userId] -- public, no auth required to view.
export function useSellerListings(sellerId: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["seller-listings", sellerId] as const,
    queryFn: () => getSellerActiveListings(supabase, sellerId),
    staleTime: 30_000,
  });
}
