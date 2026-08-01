"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  saveMarketListing,
  unsaveMarketListing,
  type SaveableListingInput,
  type SavedMarketListing,
} from "@/lib/queries/saved-market-listings";
import { useAuth } from "@/providers/auth-provider";
import { captureEvent } from "@/lib/analytics";
import { playSound } from "@/lib/sounds";

export function useToggleMarketSave() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const queryKey = ["saved-market-listings", user?.id] as const;

  return useMutation({
    mutationFn: async ({ listing, isSaved }: { listing: SaveableListingInput; isSaved: boolean }) => {
      // Re-fetch fresh rather than trust the `user` this hook captured at
      // render time -- same reasoning as useToggleSave.
      const {
        data: { user: freshUser },
      } = await supabase.auth.getUser();
      if (!freshUser) throw new Error("Not signed in");

      if (isSaved) {
        await unsaveMarketListing(supabase, freshUser.id, listing.id);
      } else {
        await saveMarketListing(supabase, freshUser.id, listing);
      }
    },
    onMutate: async ({ listing, isSaved }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SavedMarketListing[]>(queryKey);

      queryClient.setQueryData<SavedMarketListing[]>(queryKey, (old = []) =>
        isSaved
          ? old.filter((l) => l.listingId !== listing.id)
          : [
              {
                id: `optimistic-${listing.id}`,
                listingId: listing.id,
                title: listing.title,
                price: listing.price,
                imageUrl: listing.imageUrl,
                imageBlur: listing.imageBlur,
                savedAt: new Date().toISOString(),
              },
              ...old,
            ]
      );

      return { previous };
    },
    onSuccess: (_data, { listing, isSaved }) => {
      if (!isSaved) {
        captureEvent("saved_market_listing", { listing_id: listing.id });
        playSound("like");
      }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-market-listings"] });
    },
  });
}
