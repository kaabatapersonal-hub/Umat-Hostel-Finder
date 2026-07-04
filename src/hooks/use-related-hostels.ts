"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getRelatedHostels } from "@/lib/queries/hostels";

export interface UseRelatedHostelsOptions {
  hostelId: string;
  location: string;
  priceMin: number | null;
  limit?: number;
  // Gate on IntersectionObserver (see use-in-view.ts) -- the sidebar
  // enables almost immediately (it's beside the fold on desktop), the
  // mobile related-feed only once the user scrolls near the end of
  // reviews.
  enabled: boolean;
}

// Cached per hostel+limit so navigating hostel -> related -> hostel and
// back hits cache, not the network, for anything already fetched.
export function useRelatedHostels({ hostelId, location, priceMin, limit = 10, enabled }: UseRelatedHostelsOptions) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["related-hostels", hostelId, limit],
    queryFn: () => getRelatedHostels(supabase, { excludeId: hostelId, location, priceMin, limit }),
    enabled,
    staleTime: 5 * 60_000,
  });
}
