import { MessageCircle } from "lucide-react";

export interface ReviewsPlaceholderProps {
  ratingAvg: number;
  ratingCount: number;
}

// Full reviews list + submission UI land in Session 7. The header's rating
// summary already reads the cached rating_avg/rating_count, so this section
// is just a clearly-marked anchor for now, not a dead end.
export function ReviewsPlaceholder({ ratingAvg, ratingCount }: ReviewsPlaceholderProps) {
  return (
    <div id="reviews" className="flex scroll-mt-6 flex-col items-center gap-3 rounded-lg bg-surface-muted px-4 py-8 text-center">
      <MessageCircle className="size-7 text-ink-300" strokeWidth={1.5} />
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h2 text-ink-900">Reviews coming soon</h2>
        <p className="text-body-sm text-ink-500">
          {ratingCount > 0
            ? `${ratingCount} student${ratingCount === 1 ? "" : "s"} rated this hostel ${ratingAvg.toFixed(1)}/5 — the full list lands in Session 7.`
            : "No one's reviewed this hostel yet. Reviews are landing in Session 7."}
        </p>
      </div>
    </div>
  );
}
