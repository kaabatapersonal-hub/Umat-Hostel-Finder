"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { requestListingClaim } from "@/lib/queries/market";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/components/ui/toast";
import { captureEvent } from "@/lib/analytics";

export function useRequestListingClaim() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (listingId: string) => {
      if (!user) throw new Error("Not signed in");
      await requestListingClaim(supabase, listingId, user.id);
    },
    onSuccess: (_void, listingId) => {
      queryClient.invalidateQueries({ queryKey: ["my-listing-claims"] });
      queryClient.invalidateQueries({ queryKey: ["admin-listing-claims"] });
      captureEvent("requested_listing_claim", { listing_id: listingId });
      showToast({ message: "Ownership request sent — an admin will review it.", variant: "success" });
    },
    onError: () => {
      showToast({ message: "Couldn't send that request — try again?", variant: "error" });
    },
  });
}
