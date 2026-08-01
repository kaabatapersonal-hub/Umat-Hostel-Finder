"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getProfileStats } from "@/lib/queries/profiles";

export function useProfileStats(userId: string | undefined) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["profile-stats", userId] as const,
    queryFn: () => getProfileStats(supabase, userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
