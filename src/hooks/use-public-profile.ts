"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getPublicProfile } from "@/lib/queries/profiles";

export function usePublicProfile(userId: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["public-profile", userId] as const,
    queryFn: () => getPublicProfile(supabase, userId),
    enabled: !!userId,
    staleTime: 30_000,
  });
}
