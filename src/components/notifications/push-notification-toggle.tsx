"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePushSubscription } from "@/hooks/use-push-subscription";

// Explicit opt-in row, same switch styling as LeavingCampusToggle. Hidden
// entirely when unsupported (Safari on older iOS, or no VAPID key
// configured yet) or already denied at the OS level -- nothing useful to
// offer in either case, and a dead toggle is worse than no toggle.
export function PushNotificationToggle() {
  const { isSupported, status, isSubscribed, isLoading, subscribe, unsubscribe } = usePushSubscription();

  if (!isSupported || status === "denied" || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null;

  const enabled = isSubscribed;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-surface-muted p-3">
      <div className="flex items-center gap-2.5">
        <Bell className="size-4 shrink-0 text-ink-500" />
        <span className="text-body-sm text-ink-700">Push notifications</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? "Turn off push notifications" : "Turn on push notifications"}
        disabled={isLoading}
        onClick={() => (enabled ? unsubscribe() : subscribe())}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
          enabled ? "bg-gold-500" : "bg-ink-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-md transition-transform",
            enabled ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
