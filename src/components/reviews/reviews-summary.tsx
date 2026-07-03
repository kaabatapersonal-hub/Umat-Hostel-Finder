import { MessageCircle } from "lucide-react";
import { StarRating } from "./star-rating";

export interface ReviewsSummaryProps {
  ratingAvg: number;
  ratingCount: number;
}

export function ReviewsSummary({ ratingAvg, ratingCount }: ReviewsSummaryProps) {
  if (ratingCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg bg-surface-muted px-4 py-8 text-center">
        <MessageCircle className="size-7 text-ink-300" strokeWidth={1.5} />
        <h2 className="font-display text-h2 text-ink-900">No reviews yet</h2>
        <p className="text-body-sm text-ink-500">Be the first to share your experience.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-lg bg-surface-muted px-4 py-5">
      <span className="font-display text-display text-ink-900">{ratingAvg.toFixed(1)}</span>
      <div className="flex flex-col gap-1">
        <StarRating rating={Math.round(ratingAvg)} size="md" />
        <span className="text-body-sm text-ink-500">
          {ratingCount} review{ratingCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
