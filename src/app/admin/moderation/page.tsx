"use client";

import { AlertCircle, Flag } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportedReviewCard } from "@/components/admin/reported-review-card";
import { useReportedReviews } from "@/hooks/use-reported-reviews";

export default function AdminModerationPage() {
  const { data: reviews, isPending, isError, refetch } = useReportedReviews();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-h1 text-ink-900">Moderation</h1>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load reported reviews"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<Flag className="size-7" strokeWidth={1.75} />}
          title="No reported reviews"
          description="Nothing needs your attention right now."
          className="bg-surface shadow-card"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <ReportedReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
