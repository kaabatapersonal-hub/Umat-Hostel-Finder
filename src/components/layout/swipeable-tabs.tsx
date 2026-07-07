"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { triggerHaptic } from "@/lib/haptics";

// Same 5 roots as bottom-nav.tsx's NAV_ITEMS, in the same left-to-right
// order -- kept as a separate literal rather than importing NAV_ITEMS
// because this only needs the hrefs, not the icons/labels, and duplicating
// five strings is cheaper than coupling this to the nav's UI concerns.
const TAB_ROOTS = ["/", "/map", "/buzz", "/saved", "/profile"];

// Exact-match only, not startsWith -- /hostel/[id], /buzz/[id], /submit,
// /kitchen-sink all render through AppShell too, but none of them are tabs,
// and swiping on a post detail or an image gallery must never be
// mistaken for a tab change.
function getTabIndex(pathname: string): number | null {
  const index = TAB_ROOTS.indexOf(pathname);
  return index === -1 ? null : index;
}

const SWIPE_DISTANCE_THRESHOLD_PX = 50;
const SWIPE_VELOCITY_THRESHOLD_PX_MS = 0.25;
const AXIS_LOCK_THRESHOLD_PX = 10;
// Tab-swipe is a mobile gesture -- matches the breakpoint this app already
// treats as "no longer a phone" elsewhere (admin/marketing layouts branch
// around similar widths).
const DESKTOP_BREAKPOINT_PX = 768;

export function SwipeableTabs({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const currentTabIndex = getTabIndex(pathname);
  // Holds the tab index from *before* this navigation -- synced in an
  // effect (same pattern as the fetchingRef sync in home-feed.tsx/buzz's
  // feed page) rather than mutated directly during render, so it isn't
  // sensitive to React Strict Mode's double-invoked render passes. Only
  // meaningful for tab<->tab transitions; any transition touching a
  // non-tab route (detail pages, /submit, etc.) falls back to a plain
  // fade, never a directional slide.
  const previousTabIndexRef = useRef<number | null>(currentTabIndex);
  const previousTabIndex = previousTabIndexRef.current;
  const isTabTransition = currentTabIndex !== null && previousTabIndex !== null && currentTabIndex !== previousTabIndex;
  const direction = isTabTransition ? (currentTabIndex! > previousTabIndex! ? 1 : -1) : 0;

  useEffect(() => {
    previousTabIndexRef.current = currentTabIndex;
  }, [currentTabIndex]);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const gestureAxisRef = useRef<"horizontal" | "vertical" | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    if (currentTabIndex === null) return; // not on a tab route
    if (window.innerWidth >= DESKTOP_BREAKPOINT_PX) return; // mobile-only gesture

    const target = e.target as HTMLElement;
    // Leaflet owns horizontal drags inside its own container (panning) --
    // never compete with it.
    if (target.closest(".leaflet-container")) return;
    // Swiping mid-typing (e.g. the Buzz reply box) would be infuriating.
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
    gestureAxisRef.current = null;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const start = touchStartRef.current;
    if (!start || gestureAxisRef.current) return;

    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (Math.abs(dx) < AXIS_LOCK_THRESHOLD_PX && Math.abs(dy) < AXIS_LOCK_THRESHOLD_PX) return;

    // Lock the axis once, on the first meaningful movement. If it's
    // vertical, this gesture is a scroll -- back off entirely and never
    // touch it again (no preventDefault anywhere in this component), so
    // native scrolling is never at risk of being intercepted.
    gestureAxisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || gestureAxisRef.current !== "horizontal" || currentTabIndex === null) return;

    const endTouch = e.changedTouches[0];
    const dx = endTouch.clientX - start.x;
    const elapsedMs = Math.max(Date.now() - start.time, 1);
    const velocity = Math.abs(dx) / elapsedMs;

    if (Math.abs(dx) < SWIPE_DISTANCE_THRESHOLD_PX || velocity < SWIPE_VELOCITY_THRESHOLD_PX_MS) return;

    // Swipe right (dx > 0) goes to the previous tab, swipe left to the next.
    const targetIndex = dx > 0 ? currentTabIndex - 1 : currentTabIndex + 1;
    if (targetIndex < 0 || targetIndex >= TAB_ROOTS.length) return; // at an edge, no-op

    triggerHaptic();
    router.push(TAB_ROOTS[targetIndex]);
  }

  return (
    <div
      className="relative h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pathname}
          className="h-full"
          initial={
            shouldReduceMotion || !isTabTransition ? false : { x: direction === 1 ? "100%" : "-100%", opacity: 0 }
          }
          animate={{ x: "0%", opacity: 1 }}
          exit={
            shouldReduceMotion || !isTabTransition
              ? { opacity: 0 }
              : { x: direction === 1 ? "-100%" : "100%", opacity: 0 }
          }
          transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
