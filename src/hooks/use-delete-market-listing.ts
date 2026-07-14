"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteMarketListing } from "@/lib/queries/market";

export function useDeleteMarketListing() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listingId: string) => deleteMarketListing(supabase, listingId),
    onSuccess: (_void, listingId) => {
      queryClient.invalidateQueries({ queryKey: ["market-feed"] });
      queryClient.invalidateQueries({ queryKey: ["market-listing", listingId] });
      queryClient.invalidateQueries({ queryKey: ["my-market-listings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}
