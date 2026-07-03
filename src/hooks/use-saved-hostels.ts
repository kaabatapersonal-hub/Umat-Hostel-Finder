"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getSavedHostels } from "@/lib/queries/saved-hostels";
import { useAuth } from "@/providers/auth-provider";

export function useSavedHostels() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["saved-hostels", user?.id] as const,
    queryFn: () => getSavedHostels(supabase, user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
}
