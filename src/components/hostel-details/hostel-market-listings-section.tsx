"use client";

import Link from "next/link";
import { useInView } from "@/hooks/use-in-view";
import { useHostelMarketListings } from "@/hooks/use-hostel-market-listings";
import { SmartImage } from "@/components/ui/smart-image";
import { PriceTag } from "@/components/ui/price-tag";
import { Skeleton } from "@/components/ui/skeleton";
import { thumbnailSrc } from "@/lib/images";

// Lazy-loaded (useInView, same as RelatedHostelsSection/
// RelatedMarketListingsSection) and hidden entirely once we know there's
// nothing to show -- most hostels will have zero linked listings, and an
// empty-state card here on every single hostel page would just be noise
// the brief explicitly says to avoid.
export function HostelMarketListingsSection({ hostelId, hostelName }: { hostelId: string; hostelName: string }) {
  const { ref, inView } = useInView<HTMLDivElement>("600px");
  const { data: listings, isPending } = useHostelMarketListings(hostelId, inView);

  if (inView && !isPending && (!listings || listings.length === 0)) return null;

  return (
    <div ref={ref} className="flex flex-col gap-3">
      <h2 className="font-display text-h1 text-ink-900">Items for sale at {hostelName}</h2>

      {!inView || isPending ? (
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-32 shrink-0 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {listings!.map((listing) => {
            const thumbnail = listing.images[0];
            return (
              <Link
                key={listing.id}
                href={`/market/${listing.id}`}
                className="w-32 shrink-0 overflow-hidden rounded-lg bg-surface shadow-card"
              >
                <SmartImage
                  src={thumbnailSrc(thumbnail)}
                  blurDataURL={thumbnail?.blurDataURL}
                  alt={listing.title}
                  sizeHint="thumbnail"
                  className="aspect-square w-full"
                >
                  <div className="absolute left-1.5 top-1.5">
                    <PriceTag
                      amount={listing.price}
                      period={null}
                      pricePrefix={listing.isService ? "From" : null}
                      className="text-caption"
                    />
                  </div>
                </SmartImage>
                <div className="p-2">
                  <span className="line-clamp-2 text-caption font-medium text-ink-900">{listing.title}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
