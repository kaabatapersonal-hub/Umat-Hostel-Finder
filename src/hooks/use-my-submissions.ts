"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMySubmissions } from "@/lib/queries/submissions";
import { useAuth } from "@/providers/auth-provider";

export function useMySubmissions() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["my-submissions", user?.id] as const,
    queryFn: () => getMySubmissions(supabase, user!.id),
    enabled: !!user,
  });
}
