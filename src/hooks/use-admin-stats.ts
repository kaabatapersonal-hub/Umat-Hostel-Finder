"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminStats } from "@/lib/queries/admin-stats";

export function useAdminStats() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-stats"] as const,
    queryFn: () => getAdminStats(supabase),
    staleTime: 30_000,
  });
}
