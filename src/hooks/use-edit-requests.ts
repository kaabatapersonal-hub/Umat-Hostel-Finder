"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getHostelsWithPendingEdits } from "@/lib/queries/admin-edit-requests";

export function useEditRequests() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-edit-requests"] as const,
    queryFn: () => getHostelsWithPendingEdits(supabase),
  });
}
