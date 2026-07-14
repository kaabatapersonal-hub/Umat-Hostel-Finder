"use client";

import { useInView } from "@/hooks/use-in-view";
import { useRelatedMarketListings } from "@/hooks/use-related-market-listings";
import { MarketListingCard } from "./market-listing-card";
import { Skeleton } from "@/components/ui/skeleton";

// One responsive section for both mobile and desktop -- unlike hostels'
// separate sidebar/mobile-feed split, the market grid is already
// responsive via its own column-count breakpoints, so there's no separate
// desktop layout to fill eagerly.
export function RelatedMarketListingsSection({
  listingId,
  category,
  price,
}: {
  listingId: string;
  category: string;
  price: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>("600px");
  const { data: listings, isPending } = useRelatedMarketListings({ listingId, category, price, enabled: inView, limit: 8 });

  return (
    <div ref={ref} className="flex flex-col gap-3">
      <h2 className="font-display text-h1 text-ink-900">More items</h2>
      {!inView || isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
          ))}
        </div>
      ) : !listings || listings.length === 0 ? (
        <p className="text-body-sm text-ink-300">No other listings to show right now.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing, i) => (
            <MarketListingCard key={listing.id} listing={listing} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
