"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getUnreadNotificationsCount } from "@/lib/queries/notifications";
import { useAuth } from "@/providers/auth-provider";

// Query key is ["notifications-unread-count", userId] -- kept separate
// from the ["notifications", userId] list query so the bell badge (every
// page, every render) never has to pull the full notification list just
// to show a number. notifications-realtime-sync.tsx patches this same
// cache entry directly on every Realtime event.
export function useUnreadNotificationsCount() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["notifications-unread-count", user?.id] as const,
    queryFn: () => getUnreadNotificationsCount(supabase),
    enabled: !!user,
    staleTime: 15_000,
  });
}
