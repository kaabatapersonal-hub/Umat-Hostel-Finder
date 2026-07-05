"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getPinnedBuzzPosts } from "@/lib/queries/buzz";

export function usePinnedBuzzPosts() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["buzz-pinned"] as const,
    queryFn: () => getPinnedBuzzPosts(supabase),
    staleTime: 30_000,
  });
}
