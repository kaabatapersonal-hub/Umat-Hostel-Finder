"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMyReviewForHostel } from "@/lib/queries/reviews";
import { useAuth } from "@/providers/auth-provider";

export function useMyReview(hostelId: string) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["my-review", hostelId, user?.id] as const,
    queryFn: () => getMyReviewForHostel(supabase, hostelId, user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
}
