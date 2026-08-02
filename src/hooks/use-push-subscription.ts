"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { savePushSubscription, deletePushSubscription } from "@/lib/queries/push-subscriptions";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/components/ui/toast";

type PushSupportStatus = "unsupported" | "default" | "granted" | "denied";

// Returns a BufferSource, not just a Uint8Array -- TS's DOM lib types
// PushSubscriptionOptionsInit.applicationServerKey as BufferSource, and a
// Uint8Array's own `.buffer` type doesn't structurally satisfy that on
// current lib.dom.d.ts without an explicit ArrayBuffer copy.
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  return bytes.buffer;
}

// Explicit opt-in only -- never auto-prompts on load. Browsers throttle/
// flag repeated permission prompts, and an unsolicited one on first visit
// overwhelmingly just gets auto-denied, burning the ability to ask again
// later without the user manually resetting site permissions.
export function usePushSubscription() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const [status, setStatus] = useState<PushSupportStatus>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    if (!isSupported) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as PushSupportStatus);

    navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setIsSubscribed(!!existing);
    });
  }, [isSupported]);

  // Every early-return path here used to fail completely silently -- no
  // toast, no state change, nothing -- which is exactly what made the
  // toggle look "stuck" or "broken" (a rejected promise from
  // pushManager.subscribe(), a denied permission prompt, or a missing
  // VAPID key all looked identical to the user: tap it, nothing happens).
  // Every path now either succeeds or says why it didn't.
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      showToast({ message: "Notifications aren't supported in this browser.", variant: "error" });
      return;
    }
    if (!user) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      showToast({ message: "Notifications aren't set up yet — try again later.", variant: "error" });
      return;
    }

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      setStatus(permission as PushSupportStatus);
      if (permission !== "granted") {
        if (permission === "denied") {
          showToast({
            message: "Notifications are blocked — allow them in your browser's site settings to turn this on.",
            variant: "error",
          });
        }
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        showToast({ message: "Couldn't turn on notifications — try again.", variant: "error" });
        return;
      }

      await savePushSubscription(supabase, user.id, {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      setIsSubscribed(true);
      showToast({ message: "Notifications turned on!", variant: "success" });
    } catch {
      showToast({ message: "Couldn't turn on notifications — try again.", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, supabase, showToast]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(supabase, subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch {
      showToast({ message: "Couldn't turn off notifications — try again.", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, supabase, showToast]);

  return { isSupported, status, isSubscribed, isLoading, subscribe, unsubscribe };
}
