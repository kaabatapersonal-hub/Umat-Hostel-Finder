"use client";

import { use } from "react";
import { AlertCircle, ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonLine } from "@/components/ui/skeleton";
import { MarketListingForm } from "@/components/market/market-listing-form";
import { useAuth } from "@/providers/auth-provider";
import { useMarketListing } from "@/hooks/use-market-listing";

export default function EditMarketListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading, requireAuth } = useAuth();
  const { data: listing, isPending } = useMarketListing(id);

  if (loading || (user && isPending)) {
    return (
      <div className="flex flex-col gap-3 px-4 pt-6">
        <SkeletonLine className="h-8 w-1/2" />
        <SkeletonLine className="h-32 w-full rounded-md" />
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-7" strokeWidth={1.75} />}
        title="Sign in to edit this listing"
        description="Only the seller (or an admin) can edit a listing."
        actionLabel="Sign In"
        onAction={() => requireAuth(() => {})}
        className="mx-4 mt-6 bg-surface shadow-card"
      />
    );
  }

  if (!listing || listing.sellerId !== user.id) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
        title="Can't edit this listing"
        description="It may have been removed, or it isn't yours to edit."
        className="mx-4 mt-6 bg-surface shadow-card"
      />
    );
  }

  return <MarketListingForm mode={{ kind: "edit", listingId: id }} initialListing={listing} />;
}
