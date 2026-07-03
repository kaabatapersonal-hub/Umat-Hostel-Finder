"use client";

import { Building2, Star, FileClock, Heart, PenLine, Flag, BadgeCheck, MapPinOff, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStats } from "@/hooks/use-admin-stats";

export default function AdminDashboardPage() {
  const { data: stats, isPending, isError, refetch } = useAdminStats();

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
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-h1 text-ink-900">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Live hostels" value={stats.totalHostels} icon={Building2} />
        <StatCard label="Reviews" value={stats.totalReviews} icon={Star} />
        <StatCard label="Pending submissions" value={stats.pendingSubmissions} icon={FileClock} tone="warning" />
        <StatCard label="Total saves" value={stats.totalSaves} icon={Heart} />
        <StatCard label="Hostels with pending edits" value={stats.hostelsWithPendingEdits} icon={PenLine} tone="warning" />
        <StatCard label="Reported reviews" value={stats.reportedReviews} icon={Flag} tone="warning" />
        <StatCard label="Actively featured" value={stats.activeFeaturedHostels} icon={BadgeCheck} />
        <StatCard label="Missing coordinates" value={stats.hostelsMissingCoordinates} icon={MapPinOff} tone="warning" />
      </div>
    </div>
  );
}
