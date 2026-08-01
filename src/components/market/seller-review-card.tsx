"use client";

import { useState } from "react";
import { Flag, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/reviews/star-rating";
import { useDeleteSellerReview } from "@/hooks/use-delete-seller-review";
import { useReportSellerReview } from "@/hooks/use-report-seller-review";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import type { SellerReview } from "@/lib/queries/seller-reviews";

export interface SellerReviewCardProps {
  review: SellerReview;
  isOwn: boolean;
  onEdit?: () => void;
}

// No honest-badge slot here, unlike ReviewCard -- seller reviews are
// plainly self-reported, see seller-review-form.tsx's own comment on why.
export function SellerReviewCard({ review, isOwn, onEdit }: SellerReviewCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reported, setReported] = useState(false);
  const deleteReview = useDeleteSellerReview();
  const reportReview = useReportSellerReview();

  function handleDelete() {
    deleteReview.mutate({ reviewId: review.id, sellerId: review.sellerId });
  }

  function handleReport() {
    setReported(true);
    reportReview.mutate({ reviewId: review.id, sellerId: review.sellerId });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-body-strong text-brand-800">
            {getInitials(review.reviewerName, null)}
          </div>
          <div className="flex flex-col">
            <span className="line-clamp-1 text-body-strong text-ink-900">{review.reviewerName || "Student"}</span>
            <span className="text-caption text-ink-500">{formatRelativeTime(review.createdAt)}</span>
          </div>
        </div>

        {isOwn ? (
          confirmingDelete ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDelete}
                loading={deleteReview.isPending}
                className="border-danger text-danger"
              >
                Delete
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Edit your review"
                onClick={onEdit}
                className="flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Delete your review"
                onClick={() => setConfirmingDelete(true)}
                className="flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )
        ) : (
          <button
            type="button"
            aria-label={reported ? "Reported" : "Report review"}
            disabled={reported}
            onClick={handleReport}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-caption text-ink-300 hover:bg-surface-muted hover:text-ink-500 disabled:pointer-events-none"
          >
            <Flag className="size-3.5" />
            {reported ? "Reported" : "Report"}
          </button>
        )}
      </div>

      <StarRating rating={review.rating} />

      <p className="text-body text-ink-500 leading-relaxed whitespace-pre-line">{review.comment}</p>
    </div>
  );
}
