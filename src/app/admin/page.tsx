"use client";

import {
  Building2,
  Star,
  FileClock,
  Heart,
  PenLine,
  Flag,
  BadgeCheck,
  MapPinOff,
  AlertCircle,
  Users,
  MessageSquare,
  ShoppingBag,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { MarketplaceToggle } from "@/components/admin/marketplace-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStats } from "@/hooks/use-admin-stats";
import { useAuth } from "@/providers/auth-provider";
import { hasAdminPermission } from "@/lib/admin-permissions";
import type { AdminStats } from "@/lib/queries/admin-stats";
import type { AdminPermission } from "@/lib/supabase/database.types";

interface StatDef {
  label: string;
  value: (stats: AdminStats) => number;
  icon: typeof Users;
  tone?: "warning";
  permission: AdminPermission;
}

// Same "permission decides visibility" shape as admin-shell.tsx's TABS --
// the brief's own wording ("Dashboard is visible to all admins but only
// shows counts for their permitted areas") is a display decision, not a
// server-side read restriction (get_admin_stats-backed reads already
// stay is_admin()-gated broadly; see SECURITY.md's Session 22 Part 2).
const STATS: StatDef[] = [
  { label: "Registered users", value: (s) => s.totalUsers, icon: Users, permission: "manage_users" },
  { label: "Total saves", value: (s) => s.totalSaves, icon: Heart, permission: "manage_users" },
  { label: "Live hostels", value: (s) => s.totalHostels, icon: Building2, permission: "manage_hostels" },
  { label: "Pending submissions", value: (s) => s.pendingSubmissions, icon: FileClock, tone: "warning", permission: "manage_hostels" },
  {
    label: "Hostels with pending edits",
    value: (s) => s.hostelsWithPendingEdits,
    icon: PenLine,
    tone: "warning",
    permission: "manage_hostels",
  },
  { label: "Actively featured", value: (s) => s.activeFeaturedHostels, icon: BadgeCheck, permission: "manage_hostels" },
  { label: "Missing coordinates", value: (s) => s.hostelsMissingCoordinates, icon: MapPinOff, tone: "warning", permission: "manage_hostels" },
  { label: "Reviews", value: (s) => s.totalReviews, icon: Star, permission: "moderate_reviews" },
  { label: "Reported reviews", value: (s) => s.reportedReviews, icon: Flag, tone: "warning", permission: "moderate_reviews" },
  { label: "Buzz posts", value: (s) => s.totalBuzzPosts, icon: MessageSquare, permission: "moderate_buzz" },
  { label: "Active market listings", value: (s) => s.activeMarketListings, icon: ShoppingBag, permission: "moderate_market" },
  { label: "Market listings today", value: (s) => s.marketListingsToday, icon: ShoppingBag, tone: "warning", permission: "moderate_market" },
];

export default function AdminDashboardPage() {
  const { data: stats, isPending, isError, refetch } = useAdminStats();
  const { profile } = useAuth();

  const visibleStats = STATS.filter((stat) => hasAdminPermission(profile, stat.permission));
  const canModerateMarket = hasAdminPermission(profile, "moderate_market");

  if (isError) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
        title="Couldn't load stats"
        description="Check your connection and try again."
        actionLabel="Retry"
        onAction={() => refetch()}
        className="bg-surface shadow-card"
      />
    );
  }

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-h1 text-ink-900">Dashboard</h1>
      {canModerateMarket && <MarketplaceToggle />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {visibleStats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value(stats)} icon={stat.icon} tone={stat.tone} />
        ))}
      </div>
    </div>
  );
}
