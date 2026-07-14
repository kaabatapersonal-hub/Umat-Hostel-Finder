"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, MessageCircle, Share2, Check } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";
import { LinkifiedContent } from "@/components/ui/linkified-content";
import { MarketGallery } from "./market-gallery";
import { SellerInfoCard } from "./seller-info-card";
import { RelatedMarketListingsSection } from "./related-market-listings-section";
import { useMarketListing } from "@/hooks/use-market-listing";
import { useIncrementListingViews } from "@/hooks/use-increment-listing-views";
import { categoryLabel, conditionLabel } from "@/lib/market-categories";
import { buildWhatsAppLink, buildMarketInquiryMessage } from "@/lib/contact";
import { formatRelativeTime, cn } from "@/lib/utils";

export function MarketListingDetailView({ listingId }: { listingId: string }) {
  const { data: listing, isPending, isError, refetch } = useMarketListing(listingId);
  const incrementViews = useIncrementListingViews();
  const hasCountedView = useRef(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (hasCountedView.current) return;
    hasCountedView.current = true;
    incrementViews.mutate(listingId);
    // Fire-and-forget on mount only -- see useIncrementListingViews' own
    // comment on why this has no success/error handling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function handleShare() {
    if (!listing) return;
    const url = `${window.location.origin}/market/${listing.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: listing.title, url });
      } catch {
        // User dismissed the share sheet -- not an error worth surfacing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) --
      // silently do nothing rather than show a broken share affordance.
    }
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <Skeleton className="aspect-[4/3] w-full sm:aspect-video" />
        <div className="flex flex-col gap-3 px-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="px-4 pt-6">
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load this listing"
          description="It may have been removed, or check your connection."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      </div>
    );
  }

  const whatsappLink = buildWhatsAppLink(listing.contact, buildMarketInquiryMessage(listing.title));
  const condition = conditionLabel(listing.condition);

  return (
    <div className="flex flex-col gap-5 pb-8">
      <MarketGallery images={listing.images} title={listing.title} />

      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-h1 text-ink-900">{listing.title}</h1>
          <PriceTag amount={listing.price} period={null} className="self-start text-body-strong" />
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="neutral" size="sm">
              {categoryLabel(listing.category)}
            </Badge>
            {condition && (
              <Badge variant="neutral" size="sm">
                {condition}
              </Badge>
            )}
            {listing.status === "sold" && (
              <Badge variant="full" size="sm">
                Sold
              </Badge>
            )}
          </div>
          <span className="text-caption text-ink-300">Listed {formatRelativeTime(listing.createdAt)}</span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-[#25D366] text-body-strong font-semibold text-white"
          >
            <MessageCircle className="size-5" />
            Contact seller on WhatsApp
          </a>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share this listing"
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border text-ink-500 transition-colors",
              copied ? "border-brand-800 text-brand-800" : "border-line"
            )}
          >
            {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
          </button>
        </div>

        {listing.description && (
          <div className="flex flex-col gap-1.5">
            <h2 className="text-body-strong text-ink-900">Description</h2>
            <LinkifiedContent content={listing.description} />
          </div>
        )}

        <SellerInfoCard sellerId={listing.sellerId} />
      </div>

      <div className="px-4">
        <RelatedMarketListingsSection listingId={listing.id} category={listing.category} price={listing.price} />
      </div>
    </div>
  );
}
