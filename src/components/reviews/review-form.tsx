"use client";

import { useState } from "react";
import { z } from "zod";
import { Textarea, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StarPicker } from "./star-picker";
import { useSubmitReview } from "@/hooks/use-submit-review";
import type { Review } from "@/lib/queries/reviews";

const commentSchema = z.string().trim().min(15, "Share at least 15 characters — a few honest details help other students");

export interface ReviewFormProps {
  hostelId: string;
  existingReview?: Review | null;
  defaultReviewerName?: string | null;
  onDone: () => void;
  onCancel?: () => void;
}

export function ReviewForm({ hostelId, existingReview, defaultReviewerName, onDone, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [reviewerName, setReviewerName] = useState(existingReview?.reviewerName ?? defaultReviewerName ?? "");
  const [errors, setErrors] = useState<{ rating?: string; comment?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submitReview = useSubmitReview();

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
        hostelId,
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
            setFormError("You've already reviewed this hostel — refresh to see it.");
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
      <h3 className="font-display text-h2 text-ink-900">
        {existingReview ? "Edit your review" : "Write a review"}
      </h3>

      <div className="flex flex-col gap-1.5">
        <span className="text-label label text-ink-500">Rating</span>
        <StarPicker value={rating} onChange={(v) => setRating(v)} />
        {errors.rating && <p className="text-body-sm text-danger">{errors.rating}</p>}
      </div>

      <Textarea
        label="Your experience"
        placeholder="What was it like living here? Mention things like water, noise, security, or how the manager handled issues."
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
