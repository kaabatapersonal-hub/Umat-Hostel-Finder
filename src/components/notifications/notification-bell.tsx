"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useUnreadNotificationsCount } from "@/hooks/use-unread-notifications-count";
import { NotificationPanel } from "./notification-panel";

export interface NotificationBellProps {
  // TopBar is a solid dark-green header -- the bell there needs the light
  // muted tone. AdminShell is a light surface header -- same component,
  // opposite palette, rather than two separate bell components.
  variant?: "on-dark" | "on-light";
  className?: string;
}

// Hidden entirely when signed out -- notifications are private, there's
// nothing to show an anonymous visitor.
export function NotificationBell({ variant = "on-dark", className }: NotificationBellProps) {
  const { user } = useAuth();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const displayCount = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <>
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        onClick={() => setOpen(true)}
        className={cn("relative flex size-9 items-center justify-center rounded-full", className)}
      >
        <Bell className={cn("size-5", variant === "on-dark" ? "text-[#94A3B8]" : "text-ink-500")} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-[#EF4444] px-1 text-[10px] font-semibold text-white">
            {displayCount}
          </span>
        )}
      </button>
      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
