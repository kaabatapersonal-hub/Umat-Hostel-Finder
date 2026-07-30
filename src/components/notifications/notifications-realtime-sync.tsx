"use client";

import { useEffect } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { mapNotification, type GetNotificationsResult } from "@/lib/queries/notifications";
import { useAuth } from "@/providers/auth-provider";
import { playSound } from "@/lib/sounds";

type NotificationsCache = InfiniteData<GetNotificationsResult>;

// Renders nothing -- a mounted-once side-effect component, same pattern
// as <InstallPrompt /> in layout.tsx. Owns the single Supabase Realtime
// channel for the signed-in user's own notifications and patches the
// ["notifications", userId] / ["notifications-unread-count", userId]
// query caches directly (the exact keys useNotifications/
// useUnreadNotificationsCount read), rather than each component managing
// its own subscription -- one channel for the whole app, not one per
// mounted NotificationBell/NotificationPanel instance.
export function NotificationsRealtimeSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const listKey = ["notifications", user.id] as const;
    const countKey = ["notifications-unread-count", user.id] as const;

    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const notification = mapNotification(payload.new as Parameters<typeof mapNotification>[0]);

          // Only ever prepend to an already-fetched list -- if the panel
          // has never been opened, there's no cache entry to patch, and
          // the next real fetch will include this row naturally.
          queryClient.setQueryData<NotificationsCache>(listKey, (old) => {
            if (!old) return old;
            const [firstPage, ...rest] = old.pages;
            return { ...old, pages: [{ ...firstPage, notifications: [notification, ...firstPage.notifications] }, ...rest] };
          });
          queryClient.setQueryData<number>(countKey, (old) => (old ?? 0) + 1);
          playSound("success");
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const updated = mapNotification(payload.new as Parameters<typeof mapNotification>[0]);

          queryClient.setQueryData<NotificationsCache>(listKey, (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                notifications: page.notifications.map((n) => (n.id === updated.id ? updated : n)),
              })),
            };
          });
          // A batched buzz_like update (group_count going up) never
          // flips is_read, so it shouldn't touch the unread count --
          // only a genuine mark-as-read-from-another-tab case should,
          // and that's already handled optimistically by this same
          // tab's own mutation. Simplest correct approach: just
          // invalidate so the count reconciles from the server.
          queryClient.invalidateQueries({ queryKey: countKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return null;
}
