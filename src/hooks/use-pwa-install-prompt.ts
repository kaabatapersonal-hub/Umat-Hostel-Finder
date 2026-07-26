"use client";

import { useCallback, useEffect, useState } from "react";

// sessionStorage (not localStorage) for the "already asked this visit"
// flag -- it's cleared the moment the tab/browser actually closes, which
// is exactly "don't show it again until they open the browser sometime
// again." localStorage is reserved for the one flag that must survive
// forever: once actually installed, never ask again, full stop.
const DISMISSED_THIS_SESSION_KEY = "campa-install-prompt-dismissed";
const INSTALLED_KEY = "campa-installed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// The one non-standard bit Safari still needs -- iOS has never
// implemented `display-mode: standalone` detection via matchMedia
// reliably for this purpose, but has carried this flag since iOS 2.
interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

// "On their phone" -- coarse pointer rules out a desktop browser window
// just resized narrow, which matchMedia width alone can't distinguish.
function isPhoneViewport(): boolean {
  return window.matchMedia("(max-width: 640px) and (pointer: coarse)").matches;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export type InstallPromptPlatform = "android" | "ios";

export interface UsePwaInstallPromptResult {
  open: boolean;
  platform: InstallPromptPlatform | null;
  // Only ever callable when platform is "android" -- iOS has no
  // programmatic install trigger, only the manual Share sheet instructions
  // the UI shows instead.
  install: () => Promise<void>;
  dismiss: () => void;
}

// Not shown at all: already running installed (display-mode: standalone /
// iOS's navigator.standalone), already installed in a past visit
// (permanent localStorage flag), not on a phone, or already dismissed
// earlier in this same browser session.
export function usePwaInstallPrompt(): UsePwaInstallPromptResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<InstallPromptPlatform | null>(null);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      // Self-healing: if the `appinstalled` event was ever missed (e.g.
      // installed from a different entry point), a standalone launch is
      // itself proof it's installed -- lock the permanent flag now.
      localStorage.setItem(INSTALLED_KEY, "1");
      return;
    }
    if (localStorage.getItem(INSTALLED_KEY) === "1") return;
    if (sessionStorage.getItem(DISMISSED_THIS_SESSION_KEY) === "1") return;
    if (!isPhoneViewport()) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
    }

    function handleAppInstalled() {
      localStorage.setItem(INSTALLED_KEY, "1");
      setDeferredPrompt(null);
      setOpen(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // iOS Safari never fires beforeinstallprompt -- there's no
    // programmatic install trigger there at all, only the manual Share ->
    // Add to Home Screen flow, so it gets its own instructional variant
    // on a timer instead of waiting on an event that will never come.
    const iosTimer = isIos() ? setTimeout(() => setPlatform("ios"), 1500) : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  // A short beat after a platform becomes known, not the instant the tab
  // opens -- let the first paint actually be the app, not a dialog.
  useEffect(() => {
    if (!platform) return;
    const timer = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(timer);
  }, [platform]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    setOpen(false);
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "1");
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISSED_THIS_SESSION_KEY, "1");
    setOpen(false);
  }, []);

  return { open, platform, install, dismiss };
}
