"use client";

import { usePathname } from "next/navigation";
import { TopBar, TOP_BAR_HEIGHT_PX } from "./top-bar";
import { BottomNav, BOTTOM_NAV_HEIGHT_PX } from "./bottom-nav";
import { SwipeableTabs } from "./swipeable-tabs";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The hostel details page keeps its existing immersive full-bleed gallery
  // with its own overlay back button -- the fixed bar would sit on top of
  // that image for no reason, so it (and the space reserved for it) is
  // skipped entirely on that route.
  const isImmersive = pathname.startsWith("/hostel/");

  return (
    // min-h-dvh, not min-h-screen (100vh) -- on mobile browsers vh is the
    // *largest* possible viewport (as if the address bar were hidden), so a
    // page sized off vh can be taller than what's actually visible right
    // now. dvh tracks the real, currently-visible viewport, which is what
    // the fixed top bar/bottom nav math below actually needs to line up
    // against (this is also what let the Map page fill exactly the
    // available space instead of overflowing behind the nav).
    <div className="flex min-h-dvh flex-col bg-surface-muted">
      {!isImmersive && <TopBar />}
      <main
        className="flex-1"
        style={{
          paddingTop: isImmersive ? undefined : `calc(${TOP_BAR_HEIGHT_PX}px + env(safe-area-inset-top))`,
          paddingBottom: `calc(${BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
        }}
      >
        <SwipeableTabs>{children}</SwipeableTabs>
      </main>
      <BottomNav />
    </div>
  );
}
