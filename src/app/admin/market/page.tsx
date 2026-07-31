"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ShoppingBag, Search, Trash2, PlusCircle, Inbox, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAdminMarketListings } from "@/hooks/use-admin-market-listings";
import { useDeleteMarketListing } from "@/hooks/use-delete-market-listing";
import { useAdminListingClaims } from "@/hooks/use-admin-listing-claims";
import { useResolveListingClaim } from "@/hooks/use-resolve-listing-claim";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { categoryLabel } from "@/lib/market-categories";
import { formatRelativeTime } from "@/lib/utils";
import type { AdminMarketListingRow, AdminListingClaimRow } from "@/lib/queries/market";

const STATUS_BADGE_VARIANT: Record<string, "available" | "neutral" | "full" | "filling"> = {
  active: "available",
  sold: "neutral",
  removed: "full",
  pending_launch: "filling",
};

function ListingClaimRow({ claim }: { claim: AdminListingClaimRow }) {
  const resolveClaim = useResolveListingClaim();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3 shadow-card">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-1 text-body-strong text-ink-900">{claim.listingTitle}</span>
        <span className="line-clamp-1 text-caption text-ink-500">
          Requested by {claim.claimantName || "a student"} · {formatRelativeTime(claim.createdAt)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-danger"
          aria-label="Reject claim"
          onClick={() => resolveClaim.mutate({ claimId: claim.id, action: "reject" })}
          disabled={resolveClaim.isPending}
        >
          <X className="size-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Approve claim"
          onClick={() => resolveClaim.mutate({ claimId: claim.id, action: "approve" })}
          loading={resolveClaim.isPending}
        >
          <Check className="size-3.5" />
          Approve
        </Button>
      </div>
    </div>
  );
}

function PendingClaimsSection() {
  const { data: claims, isPending } = useAdminListingClaims("pending");

  if (isPending) return <Skeleton className="h-16 w-full rounded-lg" />;
  if (!claims || claims.length === 0) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-label label text-ink-500">
        <Inbox className="size-4" />
        Ownership requests ({claims.length})
      </div>
      <div className="flex flex-col gap-2">
        {claims.map((claim) => (
          <ListingClaimRow key={claim.id} claim={claim} />
        ))}
      </div>
    </section>
  );
}

function MarketListingModerationRow({ listing }: { listing: AdminMarketListingRow }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteListing = useDeleteMarketListing();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3 shadow-card">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-1 text-body-strong text-ink-900">{listing.title}</span>
        <span className="line-clamp-1 text-caption text-ink-500">
          {listing.isUnclaimed
            ? `${listing.vendorName || "Unclaimed vendor"} (unclaimed)`
            : listing.sellerName || listing.sellerEmail || "Unknown seller"}{" "}
          · {categoryLabel(listing.category)} · {formatRelativeTime(listing.createdAt)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={STATUS_BADGE_VARIANT[listing.status] ?? "neutral"} size="sm">
          {listing.status === "pending_launch" ? "pending launch" : listing.status}
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-h1 text-ink-900">Market</h1>
        <Link href="/admin/market/new">
          <Button variant="accent" size="sm">
            <PlusCircle className="size-4" />
            Add Product
          </Button>
        </Link>
      </div>

      <PendingClaimsSection />

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
