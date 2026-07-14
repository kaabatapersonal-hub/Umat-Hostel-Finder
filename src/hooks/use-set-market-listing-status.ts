"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { setMarketListingStatus } from "@/lib/queries/market";
import type { MarketListingStatus } from "@/lib/supabase/database.types";

export function useSetMarketListingStatus() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId, status }: { listingId: string; status: MarketListingStatus }) =>
      setMarketListingStatus(supabase, listingId, status),
    onSuccess: (_void, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: ["market-feed"] });
      queryClient.invalidateQueries({ queryKey: ["market-listing", listingId] });
      queryClient.invalidateQueries({ queryKey: ["my-market-listings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}
