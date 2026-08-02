"use client";

import { Bell } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { usePushSubscription } from "@/hooks/use-push-subscription";

// Explicit opt-in row. Hidden entirely when unsupported (Safari on older
// iOS, or no VAPID key configured yet) or already denied at the OS level
// -- nothing useful to offer in either case, and a dead toggle is worse
// than no toggle. "Notify me" instead of "Push notifications" -- students
// don't know what "push" means as a technical term, they know whether
// they want to hear from the app or not.
export function PushNotificationToggle() {
  const { isSupported, status, isSubscribed, isLoading, subscribe, unsubscribe } = usePushSubscription();

  if (!isSupported || status === "denied" || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null;

  const enabled = isSubscribed;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-surface-muted p-3">
      <div className="flex items-center gap-2.5">
        <Bell className="size-4 shrink-0 text-ink-500" />
        <span className="text-body-sm text-ink-700">Notify me about replies, likes, and updates</span>
      </div>
      <Toggle
        checked={enabled}
        onChange={() => (enabled ? unsubscribe() : subscribe())}
        label={enabled ? "Turn off notifications" : "Turn on notifications"}
        disabled={isLoading}
      />
    </div>
  );
}
