"use client";

import { AlertCircle, MessageCircle, Share2, Check, PlaneTakeoff, Package } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MarketListingCard } from "./market-listing-card";
import { useSellerInfo } from "@/hooks/use-seller-info";
import { useSellerListings } from "@/hooks/use-seller-listings";
import { useShare } from "@/hooks/use-share";
import { buildWhatsAppLink } from "@/lib/contact";
import { getInitials, cn } from "@/lib/utils";

// Public, no sign-in required -- both underlying reads (get_seller_public_
// profile, market_listings select) are already anon-callable. Shareable to
// WhatsApp status precisely because it works signed-out.
export function SellerSaleView({ sellerId }: { sellerId: string }) {
  const { data: sellerInfo, isPending: sellerPending, isError, refetch } = useSellerInfo(sellerId);
  const { data: listings, isPending: listingsPending } = useSellerListings(sellerId);
  const { share, copied } = useShare();

  if (sellerPending || listingsPending) {
    return (
      <div className="flex flex-col gap-5 px-4 py-6">
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !sellerInfo?.profile) {
    return (
      <div className="px-4 pt-6">
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load this seller"
          description="This page may not exist, or check your connection."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      </div>
    );
  }

  const { profile } = sellerInfo;
  const name = profile.fullName || "Student";
  const activeListings = listings ?? [];
  const firstContact = activeListings[0]?.contact;
  const whatsappLink = firstContact
    ? buildWhatsAppLink(firstContact, `Hi, I saw your listings on UMaT Hostel Finder`)
    : null;

  function handleShare() {
    share(
      profile.isLeavingSale ? `${name}'s Leaving Sale` : `${name}'s Listings`,
      typeof window !== "undefined" ? window.location.href : ""
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-6 pb-10">
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-800 font-display text-h1 text-white">
            {getInitials(name, null)}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="line-clamp-1 font-display text-h1 text-ink-900">
              {profile.isLeavingSale ? `${name}'s Leaving Sale` : `${name}'s Listings`}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {profile.isLeavingSale && (
                <Badge variant="featured" size="sm">
                  <PlaneTakeoff className="size-3" />
                  Leaving Campus
                </Badge>
              )}
              {profile.leavingDate && (
                <span className="text-caption text-ink-500">
                  Leaving {new Date(profile.leavingDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-[#25D366] text-body-strong font-semibold text-white"
            >
              <MessageCircle className="size-5" />
              Contact seller on WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share this sale page"
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border text-ink-500 transition-colors",
              copied ? "border-brand-800 text-brand-800" : "border-line"
            )}
          >
            {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
          </button>
        </div>
      </div>

      {activeListings.length === 0 ? (
        <EmptyState
          icon={<Package className="size-7" strokeWidth={1.75} />}
          title="No active listings"
          description="This seller doesn't have anything for sale right now."
          className="bg-surface shadow-card"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {activeListings.map((listing, i) => (
            <MarketListingCard key={listing.id} listing={listing} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
