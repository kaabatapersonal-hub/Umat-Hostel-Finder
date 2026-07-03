"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getSubmissionForEdit } from "@/lib/queries/submissions";

export function useSubmissionForEdit(submissionId: string | null) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["submission-for-edit", submissionId] as const,
    queryFn: () => getSubmissionForEdit(supabase, submissionId!),
    enabled: !!submissionId,
  });
}
