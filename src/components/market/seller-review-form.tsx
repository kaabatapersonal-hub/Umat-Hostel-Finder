"use client";

import { useState } from "react";
import { z } from "zod";
import { Textarea, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StarPicker } from "@/components/reviews/star-picker";
import { useSubmitSellerReview } from "@/hooks/use-submit-seller-review";
import type { SellerReview } from "@/lib/queries/seller-reviews";

const commentSchema = z.string().trim().min(15, "Share at least 15 characters — a few honest details help other students");

export interface SellerReviewFormProps {
  sellerId: string;
  existingReview?: SellerReview | null;
  defaultReviewerName?: string | null;
  onDone: () => void;
  onCancel?: () => void;
}

export function SellerReviewForm({ sellerId, existingReview, defaultReviewerName, onDone, onCancel }: SellerReviewFormProps) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [reviewerName, setReviewerName] = useState(existingReview?.reviewerName ?? defaultReviewerName ?? "");
  const [errors, setErrors] = useState<{ rating?: string; comment?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submitReview = useSubmitSellerReview();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nextErrors: typeof errors = {};
    if (rating < 1 || rating > 5) nextErrors.rating = "Pick a rating";
    const commentResult = commentSchema.safeParse(comment);
    if (!commentResult.success) nextErrors.comment = commentResult.error.issues[0]?.message;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    submitReview.mutate(
      {
        sellerId,
        existingReviewId: existingReview?.id,
        rating,
        comment: comment.trim(),
        reviewerName: reviewerName.trim() || null,
      },
      {
        onSuccess: onDone,
        onError: (err) => {
          const code = (err as { code?: string })?.code;
          if (code === "23505") {
            setFormError("You've already reviewed this seller — refresh to see it.");
          } else if (code === "23514") {
            setFormError("Comment must be at least 15 characters.");
          } else {
            setFormError("Something went wrong. Check your connection and try again.");
          }
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4">
      <h3 className="font-display text-h2 text-ink-900">{existingReview ? "Edit your review" : "Rate this seller"}</h3>

      <div className="flex flex-col gap-1.5">
        <span className="text-label label text-ink-500">Rating</span>
        <StarPicker value={rating} onChange={(v) => setRating(v)} />
        {errors.rating && <p className="text-body-sm text-danger">{errors.rating}</p>}
      </div>

      <Textarea
        label="Your experience"
        placeholder="How was buying from this seller? Mention things like responsiveness, item condition, or meeting up."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        error={errors.comment}
        rows={4}
      />

      <Input
        label="Display name (optional)"
        placeholder="Defaults to your profile name"
        value={reviewerName}
        onChange={(e) => setReviewerName(e.target.value)}
        maxLength={80}
      />

      {formError && <p className="text-body-sm text-danger">{formError}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="accent" size="lg" loading={submitReview.isPending} className="flex-1">
          {existingReview ? "Save changes" : "Post review"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
