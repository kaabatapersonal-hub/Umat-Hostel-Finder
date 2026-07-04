"use client";

import { usePathname } from "next/navigation";
import { TopBar, TOP_BAR_HEIGHT_PX } from "./top-bar";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The hostel details page keeps its existing immersive full-bleed gallery
  // with its own overlay back button -- the fixed bar would sit on top of
  // that image for no reason, so it (and the space reserved for it) is
  // skipped entirely on that route.
  const isImmersive = pathname.startsWith("/hostel/");

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      {!isImmersive && <TopBar />}
      <main
        className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))]"
        style={
          isImmersive ? undefined : { paddingTop: `calc(${TOP_BAR_HEIGHT_PX}px + env(safe-area-inset-top))` }
        }
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
