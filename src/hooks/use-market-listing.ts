"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMarketListingById } from "@/lib/queries/market";

export function useMarketListing(id: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["market-listing", id] as const,
    queryFn: () => getMarketListingById(supabase, id),
  });
}
