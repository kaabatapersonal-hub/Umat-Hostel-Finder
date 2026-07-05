"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminUserDetail } from "@/lib/queries/admin-users";

export function useAdminUserDetail(userId: string | null) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-user-detail", userId] as const,
    queryFn: () => getAdminUserDetail(supabase, userId as string),
    enabled: !!userId,
  });
}
