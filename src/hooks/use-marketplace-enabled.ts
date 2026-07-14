"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAppConfigBoolean } from "@/lib/queries/app-config";

export const MARKETPLACE_ENABLED_QUERY_KEY = ["marketplace-enabled"] as const;

export function useMarketplaceEnabled() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: MARKETPLACE_ENABLED_QUERY_KEY,
    queryFn: () => getAppConfigBoolean(supabase, "marketplace_enabled", false),
    staleTime: 0,
  });
}
