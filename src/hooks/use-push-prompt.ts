"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { usePushSubscription } from "@/hooks/use-push-subscription";

const DISMISSED_THIS_SESSION_KEY = "campa-push-prompt-dismissed";

// The push toggle living inside the notification panel is opt-in but
// effectively invisible -- almost nobody finds a switch buried behind a
// bell icon on their own. This is the active version: a friendly prompt
// on app open for a signed-in user who hasn't decided either way yet.
// Session-based dismiss (not permanent), same as the install prompt --
// it comes back next time they open the app, for as long as the
// underlying fact (not subscribed, not denied) stays true.
export function usePushPrompt() {
  const { user } = useAuth();
  const { isSupported, status, isSubscribed, subscribe } = usePushSubscription();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!isSupported || status === "denied" || isSubscribed) return;
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
    if (sessionStorage.getItem(DISMISSED_THIS_SESSION_KEY) === "1") return;

    // A beat after the app itself has painted, not the instant it loads
    // -- same reasoning as every other first-open prompt in this app.
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [user, isSupported, status, isSubscribed]);

  function dismiss() {
    sessionStorage.setItem(DISMISSED_THIS_SESSION_KEY, "1");
    setOpen(false);
  }

  async function accept() {
    setOpen(false);
    await subscribe();
  }

  return { open, dismiss, accept };
}
