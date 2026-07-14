"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { updateMarketListing, type UpdateMarketListingInput } from "@/lib/queries/market";

export function useUpdateMarketListing() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateMarketListingInput) => updateMarketListing(supabase, input),
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["market-feed"] });
      queryClient.invalidateQueries({ queryKey: ["market-listing", listing.id] });
      queryClient.invalidateQueries({ queryKey: ["my-market-listings"] });
    },
  });
}
