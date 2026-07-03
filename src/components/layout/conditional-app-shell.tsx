"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";

// The admin panel (Session 10) is a distinct surface with its own tabbed
// nav (AdminShell) -- it must not also carry the student bottom nav. The
// root layout is a Server Component with no direct access to the current
// pathname, so this thin client wrapper is the switch point.
export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
