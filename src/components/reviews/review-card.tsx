"use client";

import { useState } from "react";
import { Flag, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StarRating } from "./star-rating";
import { useDeleteReview } from "@/hooks/use-delete-review";
import { useReportReview } from "@/hooks/use-report-review";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import type { Review } from "@/lib/queries/reviews";

export interface ReviewCardProps {
  review: Review;
  isOwn: boolean;
  onEdit?: () => void;
  // The honest signal (Session 7) — "Saved this hostel" / "Submitted this
  // listing" / null. Resolved by the caller so this card never needs to
  // know the rules, just the label.
  honestBadge: string | null;
}

export function ReviewCard({ review, isOwn, onEdit, honestBadge }: ReviewCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reported, setReported] = useState(false);
  const deleteReview = useDeleteReview();
  const reportReview = useReportReview();

  function handleDelete() {
    deleteReview.mutate({ reviewId: review.id, hostelId: review.hostelId });
  }

  function handleReport() {
    setReported(true);
    reportReview.mutate({ reviewId: review.id, hostelId: review.hostelId });
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
                className="flex size-8 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Delete your review"
                onClick={() => setConfirmingDelete(true)}
                className="flex size-8 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
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

      {honestBadge && (
        <Badge variant="neutral" className="w-fit">
          {honestBadge}
        </Badge>
      )}
    </div>
  );
}
