"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SkeletonLine } from "@/components/ui/skeleton";
import { ReviewsSummary } from "@/components/reviews/reviews-summary";
import { SellerReviewForm } from "./seller-review-form";
import { SellerReviewCard } from "./seller-review-card";
import { useAuth } from "@/providers/auth-provider";
import { useMySellerReview } from "@/hooks/use-my-seller-review";
import { useSellerReviews } from "@/hooks/use-seller-reviews";

export interface SellerReviewsSectionProps {
  sellerId: string;
  ratingAvg: number;
  ratingCount: number;
}

export function SellerReviewsSection({ sellerId, ratingAvg, ratingCount }: SellerReviewsSectionProps) {
  const { user, profile, requireAuth } = useAuth();
  const { data: myReview, isPending: myReviewPending } = useMySellerReview(sellerId);
  const reviewsQuery = useSellerReviews(sellerId);
  const [editing, setEditing] = useState(false);

  const allReviews = useMemo(() => reviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [], [reviewsQuery.data]);
  const visibleReviews = editing ? allReviews.filter((r) => r.id !== myReview?.id) : allReviews;

  // A seller can't review themselves (author_id <> seller_id CHECK) -- no
  // form at all when viewing your own seller reviews.
  const isOwnSellerPage = user?.id === sellerId;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-h1 text-ink-900">Seller Reviews</h2>

      <ReviewsSummary ratingAvg={ratingAvg} ratingCount={ratingCount} />

      {isOwnSellerPage ? null : !user ? (
        <EmptyState
          icon={<MessageCircle className="size-7" strokeWidth={1.75} />}
          title="Sign in to rate this seller"
          description="Share how buying from them went to help other students."
          actionLabel="Sign In"
          onAction={() => requireAuth(() => {})}
          className="bg-surface shadow-card"
        />
      ) : myReviewPending ? (
        <SkeletonLine className="h-40 w-full rounded-md" />
      ) : !myReview || editing ? (
        <SellerReviewForm
          sellerId={sellerId}
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
            <SellerReviewCard key={review.id} review={review} isOwn={review.authorId === user?.id} onEdit={() => setEditing(true)} />
          ))}
        </div>
      )}

      {reviewsQuery.hasNextPage && (
        <Button variant="secondary" onClick={() => reviewsQuery.fetchNextPage()} loading={reviewsQuery.isFetchingNextPage}>
          Show more reviews
        </Button>
      )}

      <p className="text-caption text-ink-300">Reviews reflect individual students&apos; experiences.</p>
    </section>
  );
}
