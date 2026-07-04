"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getReportedReviews } from "@/lib/queries/admin-reviews";

export function useReportedReviews() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-reported-reviews"] as const,
    queryFn: () => getReportedReviews(supabase),
  });
}
