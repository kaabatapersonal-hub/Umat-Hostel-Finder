"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMyMarketListings } from "@/lib/queries/market";

export function useMyMarketListings(sellerId: string | undefined) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["my-market-listings", sellerId] as const,
    queryFn: () => getMyMarketListings(supabase, sellerId as string),
    enabled: !!sellerId,
  });
}
