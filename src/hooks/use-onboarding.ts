"use client";

import { useEffect, useState } from "react";

// Permanent, not session -- a tutorial is a once-ever thing, unlike the
// install prompt's per-session dismiss. Bumping this key (not clearing
// storage) is the intended way to re-show a reworked tutorial later.
const SEEN_KEY = "campa-onboarding-seen-v1";

export function useOnboarding() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY) === "1") return;
    // A short beat after first paint, same reasoning as the install
    // prompt's own delay -- let the app itself be the first thing shown,
    // not a dialog blocking an unpainted screen.
    const timer = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }

  return { open, dismiss };
}
