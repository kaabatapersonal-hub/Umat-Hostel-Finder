"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getPendingLaunchCount } from "@/lib/queries/market";

// Anon-callable public aggregate -- backs the pre-launch home's "X products
// already submitted" stat, so unlike useUnreadNotificationsCount this is
// never gated on being signed in.
export function usePendingLaunchCount() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["market-pending-launch-count"] as const,
    queryFn: () => getPendingLaunchCount(supabase),
    staleTime: 30_000,
  });
}
