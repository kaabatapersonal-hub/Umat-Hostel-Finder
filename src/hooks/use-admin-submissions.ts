"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminSubmissions } from "@/lib/queries/admin-submissions";

export function useAdminSubmissions(status?: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-submissions", status ?? "all"] as const,
    queryFn: () => getAdminSubmissions(supabase, { status }),
  });
}
