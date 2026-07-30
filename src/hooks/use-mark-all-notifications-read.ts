"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { markAllNotificationsRead, type GetNotificationsResult } from "@/lib/queries/notifications";
import { useAuth } from "@/providers/auth-provider";

type NotificationsCache = InfiniteData<GetNotificationsResult>;

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const listKey = ["notifications", user?.id] as const;
  const countKey = ["notifications-unread-count", user?.id] as const;

  return useMutation({
    mutationFn: () => markAllNotificationsRead(supabase),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: countKey });

      const previousList = queryClient.getQueryData<NotificationsCache>(listKey);
      const previousCount = queryClient.getQueryData<number>(countKey);

      queryClient.setQueryData<NotificationsCache>(listKey, (old) =>
        old
          ? { ...old, pages: old.pages.map((page) => ({ ...page, notifications: page.notifications.map((n) => ({ ...n, isRead: true })) })) }
          : old
      );
      queryClient.setQueryData<number>(countKey, 0);

      return { previousList, previousCount };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousList) queryClient.setQueryData(listKey, context.previousList);
      if (context?.previousCount !== undefined) queryClient.setQueryData(countKey, context.previousCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: countKey });
    },
  });
}
