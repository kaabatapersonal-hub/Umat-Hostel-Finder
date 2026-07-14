"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ShoppingBag, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAdminMarketListings } from "@/hooks/use-admin-market-listings";
import { useDeleteMarketListing } from "@/hooks/use-delete-market-listing";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { categoryLabel } from "@/lib/market-categories";
import { formatRelativeTime } from "@/lib/utils";
import type { AdminMarketListingRow } from "@/lib/queries/market";

const STATUS_BADGE_VARIANT: Record<string, "available" | "neutral" | "full"> = {
  active: "available",
  sold: "neutral",
  removed: "full",
};

function MarketListingModerationRow({ listing }: { listing: AdminMarketListingRow }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteListing = useDeleteMarketListing();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3 shadow-card">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-1 text-body-strong text-ink-900">{listing.title}</span>
        <span className="line-clamp-1 text-caption text-ink-500">
          {listing.sellerName || listing.sellerEmail || "Unknown seller"} · {categoryLabel(listing.category)} ·{" "}
          {formatRelativeTime(listing.createdAt)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={STATUS_BADGE_VARIANT[listing.status] ?? "neutral"} size="sm">
          {listing.status}
        </Badge>
        {confirmingDelete ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border-danger text-danger"
              onClick={() => deleteListing.mutate(listing.id)}
              loading={deleteListing.isPending}
            >
              Delete
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" aria-label={`Delete ${listing.title}`} onClick={() => setConfirmingDelete(true)}>
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminMarketPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminMarketListings(debouncedSearch);
  const listings = useMemo(() => data?.pages.flatMap((page) => page.listings) ?? [], [data]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-h1 text-ink-900">Market</h1>

      <div className="flex h-12 items-center gap-2.5 rounded-md bg-surface px-3.5 shadow-card">
        <Search className="size-5 shrink-0 text-ink-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings..."
          aria-label="Search listings"
          className="w-full bg-transparent text-body text-ink-900 placeholder:text-ink-300 focus:outline-none"
        />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load listings"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-7" strokeWidth={1.75} />}
          title="No listings"
          description="Nothing to moderate right now."
          className="bg-surface shadow-card"
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {listings.map((listing) => (
              <MarketListingModerationRow key={listing.id} listing={listing} />
            ))}
          </div>
          {hasNextPage && (
            <Button variant="secondary" onClick={() => fetchNextPage()} loading={isFetchingNextPage} className="self-center">
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
