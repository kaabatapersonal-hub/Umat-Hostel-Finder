"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AuthorLink } from "@/components/ui/author-link";
import { PushNotificationToggle } from "./push-notification-toggle";
import { useNotifications } from "@/hooks/use-notifications";
import { useMarkNotificationRead } from "@/hooks/use-mark-notification-read";
import { useMarkAllNotificationsRead } from "@/hooks/use-mark-all-notifications-read";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/queries/notifications";

export interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

// Where tapping a notification should take you. The post detail page
// doesn't exist anymore (Buzz is feed-only, see buzz-post-card.tsx) --
// every Buzz notification lands on the feed with ?post={id} for the
// feed's own best-effort scroll-to-and-highlight, same as ShareButton's
// generated links and the /buzz/[id] redirect.
function notificationHref(n: AppNotification): string | null {
  switch (n.type) {
    case "buzz_reply":
    case "buzz_like":
    case "buzz_pin":
      return n.referenceId ? `/buzz?post=${n.referenceId}` : "/buzz";
    case "hostel_update":
      return n.referenceId ? `/hostel/${n.referenceId}` : null;
    case "admin_report":
      return "/admin/reports";
    case "admin_broadcast":
      return n.linkUrl;
    case "welcome":
    default:
      return null;
  }
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const router = useRouter();
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotifications({ enabled: open });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = useMemo(() => data?.pages.flatMap((page) => page.notifications) ?? [], [data]);
  const hasUnread = notifications.some((n) => !n.isRead);

  function handleTap(n: AppNotification) {
    if (!n.isRead) markRead.mutate(n.id);
    const href = notificationHref(n);
    onClose();
    if (href) router.push(href);
  }

  return (
    <Sheet open={open} onClose={onClose} className="flex max-h-[85vh] flex-col overflow-hidden">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <h2 className="font-display text-h1 text-ink-900">Notifications</h2>
        {hasUnread && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            className="text-body-sm font-medium text-brand-800"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="mb-3 shrink-0">
        <PushNotificationToggle />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-7" strokeWidth={1.75} />}
            title="No notifications yet"
            description="Replies, likes, and updates on things you've saved will show up here."
            className="bg-transparent"
          />
        ) : (
          <div className="flex flex-col gap-1">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn("flex items-start gap-2.5 rounded-md p-3", !n.isRead && "bg-brand-50/60")}
              >
                {n.actorId ? (
                  // A real actor -- the avatar is its own link to their
                  // profile, separate from the row's own tap target (a
                  // <button> can't contain a nested <a>, so these are
                  // siblings, not parent/child).
                  <AuthorLink authorId={n.actorId} className="shrink-0">
                    <UserAvatar username={n.actorName} avatarColor={null} size="sm" />
                  </AuthorLink>
                ) : (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0E4A34]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a
                        tiny static brand mark, not a candidate for next/image's
                        responsive-loading machinery. */}
                    <img src="/icon-square.svg" alt="" width={20} height={20} className="rounded-sm" />
                  </div>
                )}
                <button type="button" onClick={() => handleTap(n)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                  <span className="text-body-strong text-ink-900">{n.title}</span>
                  {n.body && <span className="line-clamp-2 text-body-sm text-ink-500">{n.body}</span>}
                  <span className="text-caption text-ink-300">{formatRelativeTime(n.createdAt)}</span>
                </button>
                {!n.isRead && <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-500" />}
              </div>
            ))}

            {hasNextPage && (
              <Button variant="secondary" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
                Load more
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
