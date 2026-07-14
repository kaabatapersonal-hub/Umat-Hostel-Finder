"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AlertCircle, MessageCircle, Share2, Check, Building2 } from "lucide-react";
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
import { useHostelOptions } from "@/hooks/use-hostel-options";
import { useShare } from "@/hooks/use-share";
import { categoryLabel, conditionLabel, serviceTypeLabel } from "@/lib/market-categories";
import { buildWhatsAppLink, buildMarketInquiryMessage } from "@/lib/contact";
import { formatRelativeTime, cn } from "@/lib/utils";

export function MarketListingDetailView({ listingId }: { listingId: string }) {
  const { data: listing, isPending, isError, refetch } = useMarketListing(listingId);
  const incrementViews = useIncrementListingViews();
  const hasCountedView = useRef(false);
  const { share, copied } = useShare();
  // Only fetched to resolve hostel_id -> a hostel name for the reverse
  // link below; a small, cached, app-wide list (see the hook), not a
  // per-listing fetch.
  const { data: hostelOptions } = useHostelOptions();

  useEffect(() => {
    if (hasCountedView.current) return;
    hasCountedView.current = true;
    incrementViews.mutate(listingId);
    // Fire-and-forget on mount only -- see useIncrementListingViews' own
    // comment on why this has no success/error handling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  function handleShare() {
    if (!listing) return;
    share(listing.title, `${window.location.origin}/market/${listing.id}`);
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

  const whatsappLink = buildWhatsAppLink(listing.contact, buildMarketInquiryMessage(listing.title, listing.isService));
  const condition = conditionLabel(listing.condition);
  const serviceType = serviceTypeLabel(listing.serviceType);
  const hostelName = listing.hostelId ? hostelOptions?.find((h) => h.id === listing.hostelId)?.name : null;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <MarketGallery images={listing.images} title={listing.title} />

      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-h1 text-ink-900">{listing.title}</h1>
          <PriceTag
            amount={listing.price}
            period={null}
            pricePrefix={listing.isService ? "From" : null}
            className="self-start text-body-strong"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="neutral" size="sm">
              {categoryLabel(listing.category)}
            </Badge>
            {serviceType && (
              <Badge variant="neutral" size="sm">
                {serviceType}
              </Badge>
            )}
            {condition && (
              <Badge variant="neutral" size="sm">
                {condition}
              </Badge>
            )}
            {listing.isLeavingSale && (
              <Badge variant="featured" size="sm">
                Leaving Sale
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

        {hostelName && (
          <Link
            href={`/hostel/${listing.hostelId}`}
            className="flex items-center gap-2 rounded-md border border-line px-3.5 py-3 text-body-sm text-ink-500"
          >
            <Building2 className="size-4 shrink-0 text-brand-800" />
            Seller is at {hostelName} →
          </Link>
        )}
      </div>

      <div className="px-4">
        <RelatedMarketListingsSection listingId={listing.id} category={listing.category} price={listing.price} />
      </div>
    </div>
  );
}
