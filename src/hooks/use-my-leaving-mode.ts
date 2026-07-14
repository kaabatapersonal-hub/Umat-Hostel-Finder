"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMyLeavingMode } from "@/lib/queries/market";

export function useMyLeavingMode(userId: string | undefined) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["my-leaving-mode", userId] as const,
    queryFn: () => getMyLeavingMode(supabase, userId as string),
    enabled: !!userId,
  });
}
