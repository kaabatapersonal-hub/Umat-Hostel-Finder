"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, FileClock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceTag } from "@/components/ui/price-tag";
import { SmartImage } from "@/components/ui/smart-image";
import { useAdminSubmissions } from "@/hooks/use-admin-submissions";
import { formatRelativeTime, cn } from "@/lib/utils";

const STATUS_TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function AdminSubmissionsPage() {
  const [status, setStatus] = useState("pending");
  const { data: submissions, isPending, isError, refetch } = useAdminSubmissions(status);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-h1 text-ink-900">Submissions</h1>

      <div className="flex gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={cn(
              "rounded-pill px-3.5 py-1.5 text-body-sm font-medium transition-colors",
              status === tab.value ? "bg-brand-800 text-white" : "bg-surface text-ink-500 shadow-card"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load submissions"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      ) : submissions.length === 0 ? (
        <EmptyState
          icon={<FileClock className="size-7" strokeWidth={1.75} />}
          title={`No ${status} submissions`}
          description="Nothing here right now."
          className="bg-surface shadow-card"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {submissions.map((submission) => (
            <Link
              key={submission.id}
              href={`/admin/submissions/${submission.id}`}
              className="flex items-center gap-3 rounded-lg bg-surface p-3 shadow-card"
            >
              <SmartImage
                src={submission.thumbnail?.url ?? null}
                blurDataURL={submission.thumbnail?.blurDataURL}
                alt={submission.name}
                sizeHint="thumbnail"
                className="size-16 shrink-0 rounded-md"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-1 text-body-strong text-ink-900">{submission.name}</span>
                <span className="line-clamp-1 text-caption text-ink-500">
                  {submission.submitterName || submission.submitterEmail || "Unknown submitter"} ·{" "}
                  {formatRelativeTime(submission.createdAt)}
                </span>
                {submission.priceMin != null && (
                  <PriceTag amount={submission.priceMin} max={submission.priceMax ?? undefined} className="w-fit text-caption" />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
