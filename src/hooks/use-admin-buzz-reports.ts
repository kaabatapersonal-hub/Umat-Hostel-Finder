"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminBuzzReports, type BuzzReportStatus } from "@/lib/queries/buzz";

export function useAdminBuzzReports(status: BuzzReportStatus = "pending") {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-buzz-reports", status] as const,
    queryFn: () => getAdminBuzzReports(supabase, { status }),
    staleTime: 15_000,
  });
}
