"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMyOwnedHostels } from "@/lib/queries/hostels";
import { useAuth } from "@/providers/auth-provider";

export function useMyOwnedHostels() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["my-owned-hostels", user?.id] as const,
    queryFn: () => getMyOwnedHostels(supabase, user!.id),
    enabled: !!user,
  });
}
