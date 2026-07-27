"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";

// The admin panel (Session 10), the /about marketing page (Session 13),
// and the /terms and /privacy legal pages are all distinct surfaces with
// their own chrome -- none of them carry the student bottom nav / top
// bar. The root layout is a Server Component with no direct access to
// the current pathname, so this thin client wrapper is the switch point.
export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy")
  ) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
