"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/reviews/star-rating";
import { useDeleteReviewAdmin } from "@/hooks/use-delete-review-admin";
import { useDismissReportAdmin } from "@/hooks/use-dismiss-report-admin";
import { formatRelativeTime } from "@/lib/utils";
import type { ReportedReviewRow } from "@/lib/queries/admin-reviews";

export function ReportedReviewCard({ review }: { review: ReportedReviewRow }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteReview = useDeleteReviewAdmin();
  const dismiss = useDismissReportAdmin();

  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/hostel/${review.hostelId}#reviews`} target="_blank" className="text-body-strong text-ink-900 hover:underline">
          {review.hostelName ?? "Unknown hostel"}
        </Link>
        <span className="text-caption text-ink-500">{formatRelativeTime(review.createdAt)}</span>
      </div>

      <StarRating rating={review.rating} />
      <p className="whitespace-pre-line text-body text-ink-500">{review.comment}</p>
      <span className="text-caption text-ink-300">— {review.reviewerName || "Student"}</span>

      <div className="flex items-center gap-2 pt-1">
        {confirmingDelete ? (
          <>
            <span className="flex-1 text-caption text-danger">Delete this review permanently?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border-danger text-danger"
              onClick={() => deleteReview.mutate({ reviewId: review.id, hostelId: review.hostelId })}
              loading={deleteReview.isPending}
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => dismiss.mutate({ reviewId: review.id, hostelId: review.hostelId })}
              loading={dismiss.isPending}
            >
              Dismiss Report
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)} disabled={dismiss.isPending}>
              Delete Review
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
