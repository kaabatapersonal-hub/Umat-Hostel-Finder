"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getSavedMarketListings } from "@/lib/queries/saved-market-listings";
import { useAuth } from "@/providers/auth-provider";

export function useSavedMarketListings() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["saved-market-listings", user?.id] as const,
    queryFn: () => getSavedMarketListings(supabase, user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
}
