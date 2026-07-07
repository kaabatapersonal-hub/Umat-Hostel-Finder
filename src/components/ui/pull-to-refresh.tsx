"use client";

import { useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD_PX = 70;
const MAX_PULL_PX = 100;
// Damps the finger's actual travel distance -- a 1:1 pull feels
// disconnected from a rubber-band gesture; real pull-to-refresh
// implementations (pull-to-refresh.js, native iOS/Android) all use some
// resistance factor rather than tracking the finger exactly.
const PULL_RESISTANCE = 0.5;

// Plain touch events, not framer-motion's drag -- drag is built for
// draggable UI elements and would fight the page's own native scrolling if
// applied to a full content wrapper. This only ever measures a gesture in
// parallel with (never instead of) normal scrolling, and only starts
// tracking when the page is already scrolled to the top.
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: React.ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    if (refreshing || window.scrollY > 0) {
      startRef.current = null;
      return;
    }
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function handleTouchMove(e: React.TouchEvent) {
    const start = startRef.current;
    if (!start || refreshing) return;
    const deltaY = e.touches[0].clientY - start.y;
    const deltaX = e.touches[0].clientX - start.x;
    // A predominantly-horizontal drag (e.g. the app's tab-swipe gesture)
    // must never also nudge this indicator -- only a genuinely vertical
    // pull counts.
    if (deltaY > 0 && deltaY > Math.abs(deltaX) && window.scrollY <= 0) {
      setPull(Math.min(deltaY * PULL_RESISTANCE, MAX_PULL_PX));
    } else {
      startRef.current = null;
      setPull(0);
    }
  }

  async function handleTouchEnd() {
    if (startRef.current === null) return;
    startRef.current = null;
    if (pull >= PULL_THRESHOLD_PX) {
      setRefreshing(true);
      setPull(0);
      await onRefresh();
      setRefreshing(false);
    } else {
      setPull(0);
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden text-ink-500"
        style={{ height: refreshing ? 40 : pull, transition: pull === 0 ? "height 0.2s ease" : undefined }}
      >
        {refreshing ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <ArrowDown
            className={cn("size-5 transition-transform", pull >= PULL_THRESHOLD_PX && "rotate-180")}
            style={{ opacity: Math.min(pull / PULL_THRESHOLD_PX, 1) }}
          />
        )}
      </div>
      {children}
    </div>
  );
}
