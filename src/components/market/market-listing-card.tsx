"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SmartImage } from "@/components/ui/smart-image";
import { PriceTag } from "@/components/ui/price-tag";
import { Badge } from "@/components/ui/badge";
import { categoryIcon, conditionLabel, serviceTypeLabel } from "@/lib/market-categories";
import { formatRelativeTime, cn } from "@/lib/utils";
import { thumbnailSrc } from "@/lib/images";
import type { MarketListing } from "@/lib/queries/market";

export interface MarketListingCardProps {
  listing: MarketListing;
  index?: number;
  animateIn?: boolean;
}

// Fixed aspect ratio, not true variable-height masonry -- SmartImage (blur-
// up, branded fallback, lazy-load, reused by every image in the app) is
// `fill`-based and needs a caller-supplied aspect ratio; true masonry would
// mean duplicating that whole component just for this grid. A consistent
// portrait-ish ratio with object-cover gets the same image-dominant,
// 2-4 column density Facebook Marketplace's own grid actually has (it
// isn't literal Pinterest masonry either).
export function MarketListingCard({ listing, index = 0, animateIn = true }: MarketListingCardProps) {
  const thumbnail = listing.images[0];
  const condition = conditionLabel(listing.condition);
  const serviceType = serviceTypeLabel(listing.serviceType);
  const isSold = listing.status === "sold";

  return (
    <motion.div
      initial={animateIn ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/market/${listing.id}`} className="block">
        <div
          className={cn(
            "overflow-hidden rounded-lg bg-surface shadow-card",
            listing.isService && "ring-1 ring-inset ring-brand-100"
          )}
        >
          <SmartImage
            src={thumbnailSrc(thumbnail)}
            blurDataURL={thumbnail?.blurDataURL}
            alt={listing.title}
            sizeHint="thumbnail"
            className="aspect-[4/5] w-full"
          >
            <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
              <PriceTag
                amount={listing.price}
                period={null}
                pricePrefix={listing.isService ? "From" : null}
                className="text-caption"
              />
              {listing.isLeavingSale && (
                <Badge variant="featured" size="sm">
                  Leaving Sale
                </Badge>
              )}
            </div>
            {isSold && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink-900/50">
                <Badge variant="full" size="md">
                  Sold
                </Badge>
              </div>
            )}
          </SmartImage>

          <div className="flex flex-col gap-1 p-2.5">
            <span className={cn("line-clamp-2 text-body-sm font-medium text-ink-900", isSold && "opacity-60")}>
              {listing.title}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {renderCategoryIcon(listing.category, "size-3 shrink-0 text-ink-500")}
              {condition && (
                <Badge variant="neutral" size="sm">
                  {condition}
                </Badge>
              )}
              {serviceType && (
                <Badge variant="neutral" size="sm">
                  {serviceType}
                </Badge>
              )}
            </div>
            <span className="text-caption text-ink-300">{formatRelativeTime(listing.createdAt)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// A plain (lowercase, non-component) render helper, not a
// `const Icon = categoryIcon(...)` variable assigned inside a component
// body -- the lookup result is always the same stable reference for a
// given category (module-level config, never recreated), but the React
// Compiler lint rule flags *any* capitalized variable assigned inside a
// component's render body and then used as a JSX tag as "a component
// defined during render," regardless of whether the lookup is actually
// stable. Wrapping it in a plain function keeps the exact same behavior
// (facilities-grid.tsx's map-callback version of this pattern is exempt
// from the rule the same way) without that false positive.
function renderCategoryIcon(category: string, className?: string) {
  const Icon = categoryIcon(category);
  return <Icon className={className} />;
}
