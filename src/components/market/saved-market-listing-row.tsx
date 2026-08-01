"use client";

import Link from "next/link";
import { SmartImage } from "@/components/ui/smart-image";
import { PriceTag } from "@/components/ui/price-tag";
import { Button } from "@/components/ui/button";
import { useToggleMarketSave } from "@/hooks/use-toggle-market-save";
import type { SavedMarketListing } from "@/lib/queries/saved-market-listings";

export function SavedMarketListingRow({ saved }: { saved: SavedMarketListing }) {
  const toggle = useToggleMarketSave();

  function handleUnsave() {
    toggle.mutate({
      listing: {
        id: saved.listingId,
        title: saved.title ?? "",
        price: saved.price ?? 0,
        imageUrl: saved.imageUrl,
        imageBlur: saved.imageBlur,
      },
      isSaved: true,
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-3">
      <Link href={`/market/${saved.listingId}`} className="shrink-0">
        <SmartImage
          src={saved.imageUrl}
          blurDataURL={saved.imageBlur}
          alt={saved.title ?? "Listing"}
          sizeHint="thumbnail"
          className="size-16 rounded-md"
        />
      </Link>

      <Link href={`/market/${saved.listingId}`} className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-1 text-body-strong text-ink-900">{saved.title}</span>
        {saved.price != null && <PriceTag amount={saved.price} className="w-fit" />}
      </Link>

      <Button variant="ghost" size="sm" onClick={handleUnsave} loading={toggle.isPending} className="shrink-0">
        Unsave
      </Button>
    </div>
  );
}
