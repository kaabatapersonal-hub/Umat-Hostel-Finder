"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getHostelOptions } from "@/lib/queries/market";

// Backs the listing form's optional "Which hostel are you at?" dropdown.
export function useHostelOptions() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["hostel-options"] as const,
    queryFn: () => getHostelOptions(supabase),
    staleTime: 5 * 60_000,
  });
}
