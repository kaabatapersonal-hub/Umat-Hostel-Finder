"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead, type AppNotification, type GetNotificationsResult } from "@/lib/queries/notifications";
import { useAuth } from "@/providers/auth-provider";

type NotificationsCache = InfiniteData<GetNotificationsResult>;

function markReadInCache(cache: NotificationsCache | undefined, id: string): NotificationsCache | undefined {
  if (!cache) return cache;
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      notifications: page.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    })),
  };
}

function findNotification(cache: NotificationsCache | undefined, id: string): AppNotification | undefined {
  return cache?.pages.flatMap((p) => p.notifications).find((n) => n.id === id);
}

// Optimistic, same short-lived-override-free shape as useSubmitReview --
// the mutation itself is fast enough (a single UPDATE ... WHERE id = ...)
// that a plain cache patch + onSettled reconciliation is simpler than a
// local override, unlike the like/bookmark buttons' rapid-tap case.
export function useMarkNotificationRead() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const listKey = ["notifications", user?.id] as const;
  const countKey = ["notifications-unread-count", user?.id] as const;

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(supabase, notificationId),
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: countKey });

      const previousList = queryClient.getQueryData<NotificationsCache>(listKey);
      const previousCount = queryClient.getQueryData<number>(countKey);
      const wasUnread = findNotification(previousList, notificationId)?.isRead === false;

      queryClient.setQueryData<NotificationsCache>(listKey, (old) => markReadInCache(old, notificationId));
      if (wasUnread) {
        queryClient.setQueryData<number>(countKey, (old) => Math.max(0, (old ?? 1) - 1));
      }

      return { previousList, previousCount };
    },
    onError: (_err, _id, context) => {
      if (context?.previousList) queryClient.setQueryData(listKey, context.previousList);
      if (context?.previousCount !== undefined) queryClient.setQueryData(countKey, context.previousCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: countKey });
    },
  });
}
