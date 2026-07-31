"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMyListingClaims } from "@/lib/queries/market";
import { useAuth } from "@/providers/auth-provider";

// One batched query per screen for "have I already requested this listing,"
// same posture as useMyBuzzReports/getMyLikedPostIds -- never one query per
// card. Callers on a single listing (the detail page) just pass a 1-item
// array and read the single entry back out.
export function useMyListingClaims(listingIds: string[]) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["my-listing-claims", user?.id, listingIds] as const,
    queryFn: () => getMyListingClaims(supabase, listingIds, user!.id),
    enabled: !!user && listingIds.length > 0,
    staleTime: 15_000,
  });
}
