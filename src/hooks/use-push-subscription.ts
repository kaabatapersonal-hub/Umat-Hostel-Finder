"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { savePushSubscription, deletePushSubscription } from "@/lib/queries/push-subscriptions";
import { useAuth } from "@/providers/auth-provider";

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

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      setStatus(permission as PushSupportStatus);
      if (permission !== "granted") return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      await savePushSubscription(supabase, user.id, {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      setIsSubscribed(true);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, supabase]);

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
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, supabase]);

  return { isSupported, status, isSubscribed, isLoading, subscribe, unsubscribe };
}
