"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SkeletonLine } from "@/components/ui/skeleton";
import { ReviewsSummary } from "./reviews-summary";
import { ReviewForm } from "./review-form";
import { ReviewCard } from "./review-card";
import { useAuth } from "@/providers/auth-provider";
import { useMyReview } from "@/hooks/use-my-review";
import { useReviews } from "@/hooks/use-reviews";
import type { Review } from "@/lib/queries/reviews";

export interface ReviewsSectionProps {
  hostelId: string;
  hostelOwnerId: string | null;
  ratingAvg: number;
  ratingCount: number;
}

// The honest resident signal (Session 7) — resolved once at post time and
// stored on the review (see lib/queries/reviews.ts), rendered here as
// plain, non-inflated language. Never "Verified Resident" — nobody's
// residence is actually verified.
function getHonestBadge(review: Review, hostelOwnerId: string | null): string | null {
  if (hostelOwnerId && review.authorId === hostelOwnerId) return "Submitted this listing";
  if (review.isResident) return "Saved this hostel";
  return null;
}

export function ReviewsSection({ hostelId, hostelOwnerId, ratingAvg, ratingCount }: ReviewsSectionProps) {
  const { user, profile, requireAuth } = useAuth();
  const { data: myReview, isPending: myReviewPending } = useMyReview(hostelId);
  const reviewsQuery = useReviews(hostelId);
  const [editing, setEditing] = useState(false);

  const allReviews = reviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [];
  const visibleReviews = editing ? allReviews.filter((r) => r.id !== myReview?.id) : allReviews;

  return (
    <section id="reviews" className="flex scroll-mt-6 flex-col gap-4">
      <h2 className="font-display text-h1 text-ink-900">Reviews</h2>

      <ReviewsSummary ratingAvg={ratingAvg} ratingCount={ratingCount} />

      {!user ? (
        <EmptyState
          icon={<MessageCircle className="size-7" strokeWidth={1.75} />}
          title="Sign in to write a review"
          description="Share your experience to help other students find the right hostel."
          actionLabel="Sign In"
          onAction={() => requireAuth(() => {})}
          className="bg-surface shadow-card"
        />
      ) : myReviewPending ? (
        <SkeletonLine className="h-40 w-full rounded-md" />
      ) : !myReview || editing ? (
        <ReviewForm
          hostelId={hostelId}
          existingReview={editing ? myReview : null}
          defaultReviewerName={profile?.fullName}
          onDone={() => setEditing(false)}
          onCancel={editing ? () => setEditing(false) : undefined}
        />
      ) : null}

      {reviewsQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <SkeletonLine className="h-28 w-full rounded-md" />
          <SkeletonLine className="h-28 w-full rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isOwn={review.authorId === user?.id}
              onEdit={() => setEditing(true)}
              honestBadge={getHonestBadge(review, hostelOwnerId)}
            />
          ))}
        </div>
      )}

      {reviewsQuery.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => reviewsQuery.fetchNextPage()}
          loading={reviewsQuery.isFetchingNextPage}
        >
          Show more reviews
        </Button>
      )}

      <p className="text-caption text-ink-300">Reviews reflect individual students&apos; experiences.</p>
    </section>
  );
}
