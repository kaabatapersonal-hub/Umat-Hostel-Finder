"use client";

import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { incrementListingViews } from "@/lib/queries/market";

// Fire-and-forget -- a failed view increment is never worth surfacing to
// the visitor, so this deliberately has no onError/onSuccess wiring.
export function useIncrementListingViews() {
  const supabase = useMemo(() => createClient(), []);

  return useMutation({
    mutationFn: (listingId: string) => incrementListingViews(supabase, listingId),
  });
}
