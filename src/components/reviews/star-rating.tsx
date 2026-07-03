import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StarRatingProps {
  rating: number;
  size?: "sm" | "md";
  className?: string;
}

// Read-only star row for a single review's rating (1-5, whole numbers only
// — the interactive picker never produces halves, so no partial-fill logic
// is needed here).
export function StarRating({ rating, size = "sm", className }: StarRatingProps) {
  const starSize = size === "sm" ? "size-3.5" : "size-5";

  return (
    <div className={cn("flex items-center gap-0.5", className)} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(starSize, star <= rating ? "fill-gold-500 text-gold-500" : "text-ink-300")}
        />
      ))}
    </div>
  );
}
