"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { resolveListingClaim } from "@/lib/queries/market";
import { useToast } from "@/components/ui/toast";

export function useResolveListingClaim() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ claimId, action }: { claimId: string; action: "approve" | "reject" }) =>
      resolveListingClaim(supabase, claimId, action),
    onSuccess: (_void, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-listing-claims"] });
      queryClient.invalidateQueries({ queryKey: ["my-listing-claims"] });
      // Approve reassigns seller_id/is_unclaimed on the underlying listing
      // -- reconcile every surface that shows ownership, same breadth as
      // useUpdateMarketListing/useDeleteMarketListing.
      queryClient.invalidateQueries({ queryKey: ["market-feed"] });
      queryClient.invalidateQueries({ queryKey: ["market-listing"] });
      queryClient.invalidateQueries({ queryKey: ["my-market-listings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-market-listings"] });
      showToast({
        message: action === "approve" ? "Claim approved — ownership transferred." : "Claim rejected.",
        variant: "success",
      });
    },
    onError: () => {
      showToast({ message: "Couldn't resolve that claim — try again?", variant: "error" });
    },
  });
}
