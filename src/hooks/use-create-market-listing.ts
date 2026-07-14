"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createMarketListing, type CreateMarketListingInput } from "@/lib/queries/market";

export type SubmitMarketListingVars = Omit<CreateMarketListingInput, "sellerId">;

export function useCreateMarketListing() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitMarketListingVars) => {
      // Re-fetch fresh rather than trust context -- this can run right
      // after the auth sheet resolves a sign-in, before React necessarily
      // re-renders with the new user (same reasoning as useSubmitHostel).
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      return createMarketListing(supabase, { ...input, sellerId: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-feed"] });
      queryClient.invalidateQueries({ queryKey: ["my-market-listings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}
