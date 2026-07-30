"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getNotifications, type NotificationCursor } from "@/lib/queries/notifications";
import { useAuth } from "@/providers/auth-provider";

// Query key is ["notifications", userId] -- shared verbatim with
// notifications-realtime-sync.tsx, which patches this exact cache entry
// on every Realtime INSERT/UPDATE so the bell and the panel (both reading
// this same hook) update live without either one polling.
export function useNotifications({ enabled = true }: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["notifications", user?.id] as const,
    queryFn: ({ pageParam }) => getNotifications(supabase, user!.id, { cursor: pageParam }),
    initialPageParam: null as NotificationCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && !!user,
  });
}
