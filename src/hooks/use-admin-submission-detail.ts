"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminSubmissionDetail } from "@/lib/queries/admin-submissions";

export function useAdminSubmissionDetail(id: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-submission-detail", id] as const,
    queryFn: () => getAdminSubmissionDetail(supabase, id),
  });
}
