"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminListingClaims, type MarketListingClaimStatus } from "@/lib/queries/market";

export function useAdminListingClaims(status: MarketListingClaimStatus = "pending") {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-listing-claims", status] as const,
    queryFn: () => getAdminListingClaims(supabase, { status }),
    staleTime: 15_000,
  });
}
