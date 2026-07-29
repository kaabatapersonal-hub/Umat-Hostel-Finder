"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMyBuzzReports } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";

// One batched query per screen (feed or post detail) for "have I already
// reported this," same posture as useMyLikedPosts/useVerifiedProfiles --
// never one query per card.
export function useMyBuzzReports() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["my-buzz-reports", user?.id] as const,
    queryFn: () => getMyBuzzReports(supabase, user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
}
