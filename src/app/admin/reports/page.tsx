"use client";

import { AlertCircle, MessageSquareWarning } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BuzzReportCard } from "@/components/admin/buzz-report-card";
import { useAdminBuzzReports } from "@/hooks/use-admin-buzz-reports";

export default function AdminReportsPage() {
  const { data: reports, isPending, isError, refetch } = useAdminBuzzReports("pending");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-h1 text-ink-900">Reports</h1>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load reports"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<MessageSquareWarning className="size-7" strokeWidth={1.75} />}
          title="No pending reports"
          description="Nothing needs your attention right now."
          className="bg-surface shadow-card"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((report) => (
            <BuzzReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
