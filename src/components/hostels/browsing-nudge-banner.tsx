"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { shouldShowBrowsingNudge, dismissBrowsingNudge } from "@/lib/nudges";

// Gentle, dismissible, once per session -- never a wall. A lazy useState
// initializer (not an effect) reads sessionStorage once at mount -- Home
// isn't part of the swipeable tab set a hostel detail page belongs to,
// so navigating there and back remounts this component fresh, and the
// lazy read picks up whatever the visit just changed with no
// effect-driven "flash in a moment later" delay. The `user` check below
// still gates visibility correctly regardless of exactly when auth
// state resolves, since it's evaluated at render time, not baked into
// the initializer.
export function BrowsingNudgeBanner() {
  const { user, requireAuth } = useAuth();
  const [visible, setVisible] = useState(() => (typeof window !== "undefined" ? shouldShowBrowsingNudge() : false));

  if (user || !visible) return null;

  function handleDismiss() {
    dismissBrowsingNudge();
    setVisible(false);
  }

  function handleJoin() {
    requireAuth(() => {}, { message: "Save hostels, post on Buzz, and sell on the Marketplace" });
  }

  return (
    <div className="flex items-center gap-3 rounded-md bg-gold-50 px-4 py-3 shadow-card">
      <span className="flex-1 text-body-sm text-ink-900">
        💛 Like what you see? Join Campa to save hostels and post on Buzz.
      </span>
      <button
        type="button"
        onClick={handleJoin}
        className="shrink-0 rounded-pill bg-brand-800 px-3.5 py-1.5 text-body-sm font-medium text-white"
      >
        Join
      </button>
      <button type="button" aria-label="Dismiss" onClick={handleDismiss} className="shrink-0 text-ink-300">
        <X className="size-4" />
      </button>
    </div>
  );
}
