"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  FileClock,
  PenLine,
  Flag,
  MessageSquareWarning,
  Users,
  ShoppingBag,
  ArrowLeft,
  ShieldAlert,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { usePendingBuzzReportsCount } from "@/hooks/use-pending-buzz-reports-count";
import type { AdminPermission } from "@/lib/supabase/database.types";

interface AdminTab {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  // Absent -> visible to every admin regardless of permissions (just the
  // Dashboard today). Every other tab maps to the one permission that
  // governs it -- see SECURITY.md's Session 22 Part 2 section for the
  // full reasoning behind each mapping.
  permission?: AdminPermission;
}

const TABS: AdminTab[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/hostels", label: "Hostels", icon: Building2, permission: "manage_hostels" },
  { href: "/admin/hostels/new", label: "Add Hostel", icon: PlusCircle, permission: "manage_hostels" },
  { href: "/admin/submissions", label: "Submissions", icon: FileClock, permission: "manage_hostels" },
  { href: "/admin/edit-requests", label: "Edit Requests", icon: PenLine, permission: "manage_hostels" },
  { href: "/admin/moderation", label: "Moderation", icon: Flag, permission: "moderate_reviews" },
  { href: "/admin/reports", label: "Reports", icon: MessageSquareWarning, permission: "moderate_buzz" },
  { href: "/admin/users", label: "Users", icon: Users, permission: "manage_users" },
  { href: "/admin/market", label: "Market", icon: ShoppingBag, permission: "moderate_market" },
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
  const { profile } = useAuth();
  const { data: pendingReportsCount } = usePendingBuzzReportsCount();

  const visibleTabs = TABS.filter((tab) => !tab.permission || hasAdminPermission(profile, tab.permission));

  // The tab whose *route* the current page belongs to, even if that tab
  // itself is filtered out of visibleTabs above -- this is what decides
  // whether to render children at all, not just whether to show the nav
  // item. admin/layout.tsx already gates role !== 'admin' server-side;
  // this is the finer-grained per-tab permission gate on top of that.
  const currentTab = TABS.find((tab) => isTabActive(tab.href, pathname));
  const canAccessCurrentTab = !currentTab?.permission || hasAdminPermission(profile, currentTab.permission);

  return (
    <div className="min-h-screen bg-surface-muted">
      <header
        className="border-b border-line bg-surface px-4 pb-3 sm:px-6"
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-h1 text-ink-900">Admin</span>
            <span className="hidden text-body-sm text-ink-500 sm:inline">Campa</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell variant="on-light" />
            <Link href="/" className="flex items-center gap-1.5 text-body-sm font-medium text-brand-800">
              <ArrowLeft className="size-4" />
              Back to app
            </Link>
          </div>
        </div>

        <nav className="mx-auto mt-3 flex max-w-5xl gap-1 overflow-x-auto">
          {visibleTabs.map(({ href, label, icon: Icon }) => {
            const active = isTabActive(href, pathname);
            const showReportsBadge = href === "/admin/reports" && !!pendingReportsCount;
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
                {showReportsBadge && (
                  <span
                    className={cn(
                      "flex h-4 min-w-4 items-center justify-center rounded-pill px-1 text-[10px] font-semibold",
                      active ? "bg-white text-brand-800" : "bg-danger text-white"
                    )}
                  >
                    {pendingReportsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {canAccessCurrentTab ? (
          children
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg bg-surface p-8 text-center shadow-card">
            <ShieldAlert className="size-8 text-ink-300" strokeWidth={1.75} />
            <div className="flex flex-col gap-1">
              <span className="text-body-strong text-ink-900">You don&apos;t have access to this section</span>
              <span className="text-body-sm text-ink-500">Ask the super admin for the right permission.</span>
            </div>
            <Link href="/admin" className="text-body-sm font-medium text-brand-800">
              Back to Dashboard
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
