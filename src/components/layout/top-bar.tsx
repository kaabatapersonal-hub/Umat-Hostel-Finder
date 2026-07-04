"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

// Height of the bar's own content row -- excludes the safe-area inset,
// which is added as separate top padding so the two don't fight over the
// same box (mirrors BottomNav's paddingBottom + content-height split).
export const TOP_BAR_HEIGHT_PX = 52;
export const TOP_BAR_SCROLL_THRESHOLD_PX = 40;

// A slim fixed bar pairing with BottomNav to frame the app, so it never
// feels "headless" once scrolled. On Home it starts fully transparent
// (blended over the hero, avoiding double-branding with the hero's own
// "UMaT · Tarkwa" eyebrow) and condenses to solid deep-green + the
// wordmark once the user scrolls past the hero. Every other tab shows the
// same wordmark, always solid -- one convention, not two.
export function TopBar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const shouldReduceMotion = useReducedMotion();
  const [condensed, setCondensed] = useState(!isHome);

  // Resyncs `condensed` when a client-side nav changes `isHome` (e.g. Home
  // -> Map keeps this component mounted, only the route changes) --
  // synchronizing local state with a route change is exactly what this
  // effect is for. Flagged by the same stricter react-hooks/set-state-in-
  // effect rule discussed in Session 12's isFirstPaint findings: reading
  // window.scrollY (needed for the SSR-safe non-effect alternative) is
  // itself impure and unavailable during SSR, so moving this out of an
  // effect trades one finding for a real crash risk instead. Left as-is.
  useEffect(() => {
    if (!isHome) {
      setCondensed(true);
      return;
    }

    function onScroll() {
      setCondensed(window.scrollY > TOP_BAR_SCROLL_THRESHOLD_PX);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const transition = { duration: shouldReduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <motion.header
      role="banner"
      animate={{ backgroundColor: condensed ? "#0e4a34" : "rgba(14, 74, 52, 0)" }}
      transition={transition}
      className="fixed inset-x-0 top-0 z-40"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center px-4" style={{ height: TOP_BAR_HEIGHT_PX }}>
        <motion.span
          animate={{ opacity: condensed ? 1 : 0 }}
          transition={transition}
          className="font-display text-body-strong text-white"
        >
          UMaT Hostel Finder
        </motion.span>
      </div>
    </motion.header>
  );
}
