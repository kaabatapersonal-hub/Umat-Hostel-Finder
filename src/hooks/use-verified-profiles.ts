"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getVerifiedProfiles } from "@/lib/queries/verification";

// Sorted so the query key is stable across re-renders that pass the same
// set of ids in a different array order (a new page of results appended
// to an existing one, for instance).
export function useVerifiedProfiles(userIds: string[]) {
  const supabase = useMemo(() => createClient(), []);
  const key = useMemo(() => [...new Set(userIds)].sort(), [userIds]);

  return useQuery({
    queryKey: ["verified-profiles", key] as const,
    queryFn: () => getVerifiedProfiles(supabase, key),
    enabled: key.length > 0,
    staleTime: 60_000,
  });
}
