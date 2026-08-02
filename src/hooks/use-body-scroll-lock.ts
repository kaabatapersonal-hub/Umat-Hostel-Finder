"use client";

import { useLayoutEffect } from "react";

// Module-level, not per-hook-instance state -- background scroll must stay
// locked for as long as ANY overlay is open, not just the most recently
// mounted one. Without a shared counter, a second sheet opened on top of
// a first (e.g. a confirm step inside an already-open sheet) would unlock
// scrolling the moment IT closes, even though the first is still open.
let lockCount = 0;
let savedScrollY = 0;

function lockBody() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    const body = document.body;
    // overflow: hidden alone doesn't reliably stop background touch-scroll
    // on iOS Safari (the well-known rubber-band-through-the-backdrop bug).
    // Pinning the body to a fixed position at its current scroll offset is
    // the technique that actually holds on real iOS devices, not just
    // desktop browsers.
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
  }
  lockCount++;
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const body = document.body;
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    body.style.overflow = "";
    // Restore exactly where the page was -- position: fixed dropped it to
    // the top, so without this the page visibly jumps once the last
    // overlay closes.
    window.scrollTo(0, savedScrollY);
  }
}

// Used by every overlay in the app (Sheet, and the two one-off centered
// modals) so background scrolling/touches are blocked for as long as
// anything is open on top of the page, on both Android and iOS.
export function useBodyScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (!locked) return;
    lockBody();
    return unlockBody;
  }, [locked]);
}
