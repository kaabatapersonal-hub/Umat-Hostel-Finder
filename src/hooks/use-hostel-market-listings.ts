"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getHostelMarketListings } from "@/lib/queries/market";

// Gated on IntersectionObserver (use-in-view.ts), same lazy-load reasoning
// as related hostels/listings -- backs the hostel detail page's "Items for
// sale at [Hostel]" section, which should stay entirely off the network
// until the user scrolls near it.
export function useHostelMarketListings(hostelId: string, enabled: boolean) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["hostel-market-listings", hostelId] as const,
    queryFn: () => getHostelMarketListings(supabase, hostelId, 10),
    enabled,
    staleTime: 60_000,
  });
}
