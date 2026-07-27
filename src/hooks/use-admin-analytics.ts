"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminUserGrowth, getAdminActiveUsers, getAdminEngagementStats } from "@/lib/queries/admin-analytics";

// Three independent queries, not one combined call -- a failure in one
// (e.g. the active-users RPC) must not blank the other two groups of
// cards, which have nothing to do with each other's data source. Each
// hook's own isError/isPending renders only the cards it's responsible
// for as loading/failed; see analytics-stat-card.tsx.
export function useAdminUserGrowth() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-analytics", "user-growth"] as const,
    queryFn: () => getAdminUserGrowth(supabase),
    staleTime: 30_000,
  });
}

export function useAdminActiveUsers() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-analytics", "active-users"] as const,
    queryFn: () => getAdminActiveUsers(supabase),
    staleTime: 30_000,
  });
}

export function useAdminEngagementStats() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-analytics", "engagement"] as const,
    queryFn: () => getAdminEngagementStats(supabase),
    staleTime: 30_000,
  });
}
