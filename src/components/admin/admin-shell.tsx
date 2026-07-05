"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, PlusCircle, FileClock, PenLine, Flag, Users, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/hostels", label: "Hostels", icon: Building2 },
  { href: "/admin/hostels/new", label: "Add Hostel", icon: PlusCircle },
  { href: "/admin/submissions", label: "Submissions", icon: FileClock },
  { href: "/admin/edit-requests", label: "Edit Requests", icon: PenLine },
  { href: "/admin/moderation", label: "Moderation", icon: Flag },
  { href: "/admin/users", label: "Users", icon: Users },
];

function isTabActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/hostels/new") return pathname === "/admin/hostels/new";
  if (href === "/admin/hostels") return pathname === "/admin/hostels" || /^\/admin\/hostels\/[^/]+\/edit$/.test(pathname);
  if (href === "/admin/submissions") return pathname === "/admin/submissions" || /^\/admin\/submissions\/[^/]+$/.test(pathname);
  return pathname === href;
}

// A distinct surface from the student app on purpose -- a tabbed tool
// layout, not the bottom-nav storefront shell. Still on-brand (same
// color/type tokens), just denser.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-h1 text-ink-900">Admin</span>
            <span className="hidden text-body-sm text-ink-500 sm:inline">UMaT Hostel Finder</span>
          </div>
          <Link href="/" className="flex items-center gap-1.5 text-body-sm font-medium text-brand-800">
            <ArrowLeft className="size-4" />
            Back to app
          </Link>
        </div>

        <nav className="mx-auto mt-3 flex max-w-5xl gap-1 overflow-x-auto">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isTabActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-body-sm font-medium transition-colors",
                  active ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
