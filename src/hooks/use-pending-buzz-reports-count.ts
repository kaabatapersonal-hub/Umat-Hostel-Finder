"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getPendingBuzzReportsCount } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";
import { hasAdminPermission } from "@/lib/admin-permissions";

// Powers the small count badge on the admin shell's Reports tab -- only
// ever queried by someone who can already see that tab (moderate_buzz),
// same gate admin-shell.tsx itself applies to the tab's visibility.
export function usePendingBuzzReportsCount() {
  const { profile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const canModerateBuzz = hasAdminPermission(profile, "moderate_buzz");

  return useQuery({
    queryKey: ["pending-buzz-reports-count"] as const,
    queryFn: () => getPendingBuzzReportsCount(supabase),
    enabled: canModerateBuzz,
    staleTime: 15_000,
  });
}
