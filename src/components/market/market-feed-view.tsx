"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Package, Plus, SlidersHorizontal, Search, PlaneTakeoff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { CategoryChips } from "@/components/market/category-chips";
import { MarketFiltersSheet } from "@/components/market/market-filters-sheet";
import { MarketListingCard } from "@/components/market/market-listing-card";
import { useMarketFeed } from "@/hooks/use-market-feed";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuth } from "@/providers/auth-provider";
import { DEFAULT_MARKET_FILTERS, hasActiveMarketFilters, type MarketFeedFilters } from "@/lib/queries/market";
import { SERVICE_TYPE_ORDER, serviceTypeLabel } from "@/lib/market-categories";
import { cn } from "@/lib/utils";
import type { MarketCategory, MarketServiceType } from "@/lib/supabase/database.types";

export function MarketFeedView() {
  const { requireAuth } = useAuth();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<MarketFeedFilters>(DEFAULT_MARKET_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Same first-paint / infinite-scroll guards as every other feed in the app.
  const isFirstPaintRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useMarketFeed({
    search: debouncedSearch,
    filters,
  });

  useEffect(() => {
    isFirstPaintRef.current = false;
  }, []);

  useEffect(() => {
    fetchingRef.current = isFetchingNextPage;
  }, [isFetchingNextPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !fetchingRef.current) fetchNextPage();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage]);

  const listings = useMemo(() => data?.pages.flatMap((page) => page.listings) ?? [], [data]);
  const isFiltering = debouncedSearch !== "" || hasActiveMarketFilters(filters);

  function setCategory(category: MarketCategory | null) {
    // Service-type only ever applies while browsing Services -- switching
    // away from that category should drop a stale sub-tag selection
    // rather than silently keep filtering by it once it's invisible.
    setFilters((prev) => ({ ...prev, category, serviceType: category === "services" ? prev.serviceType : null }));
  }

  function setServiceType(serviceType: MarketServiceType | null) {
    setFilters((prev) => ({ ...prev, serviceType: prev.serviceType === serviceType ? null : serviceType }));
  }

  function clearFilters() {
    setSearchInput("");
    setFilters(DEFAULT_MARKET_FILTERS);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PullToRefresh onRefresh={() => refetch()}>
        <div className="flex flex-col gap-4 px-4 py-5 lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-h1 text-ink-900">Market</h1>
            <Button variant="accent" size="sm" onClick={() => requireAuth(() => router.push("/market/sell"))}>
              <Plus className="size-4" />
              Sell
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-12 flex-1 items-center gap-2.5 rounded-md bg-surface px-3.5 shadow-card">
              <Search className="size-5 shrink-0 text-ink-300" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search listings..."
                aria-label="Search marketplace listings"
                className="w-full bg-transparent text-body text-ink-900 placeholder:text-ink-300 focus:outline-none"
              />
            </div>
            <button
              type="button"
              aria-label="Filters"
              onClick={() => setFiltersOpen(true)}
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-md shadow-card",
                hasActiveMarketFilters(filters) ? "bg-brand-800 text-white" : "bg-surface text-ink-500"
              )}
            >
              <SlidersHorizontal className="size-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, leavingSaleOnly: !prev.leavingSaleOnly }))}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1.5 text-body-sm font-medium transition-colors",
                filters.leavingSaleOnly ? "bg-gold-500 text-ink-900" : "bg-surface text-ink-500 shadow-card hover:bg-surface-muted"
              )}
            >
              <PlaneTakeoff className="size-3.5" />
              Leaving Sales
            </button>
          </div>

          <CategoryChips value={filters.category ?? null} onChange={setCategory} />

          {filters.category === "services" && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {SERVICE_TYPE_ORDER.map((serviceType) => (
                <button
                  key={serviceType}
                  type="button"
                  onClick={() => setServiceType(serviceType)}
                  className={cn(
                    "shrink-0 rounded-pill px-3 py-1.5 text-body-sm font-medium transition-colors",
                    filters.serviceType === serviceType
                      ? "bg-brand-800 text-white"
                      : "bg-surface text-ink-500 shadow-card hover:bg-surface-muted"
                  )}
                >
                  {serviceTypeLabel(serviceType)}
                </button>
              ))}
            </div>
          )}

          {isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState
              icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
              title="Couldn't load the marketplace"
              description="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => refetch()}
              className="bg-surface shadow-card"
            />
          ) : listings.length === 0 ? (
            <EmptyState
              icon={<Package className="size-7" strokeWidth={1.75} />}
              title={isFiltering ? "No listings match those filters" : "No listings yet"}
              description={
                isFiltering
                  ? "Try clearing a few filters or searching something else."
                  : "Be the first to list something for sale."
              }
              actionLabel={isFiltering ? "Clear filters" : "Sell something"}
              onAction={isFiltering ? clearFilters : () => requireAuth(() => router.push("/market/sell"))}
              className="bg-surface shadow-card"
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {listings.map((listing, i) => (
                  <MarketListingCard key={listing.id} listing={listing} index={i} animateIn={!isFirstPaintRef.current} />
                ))}
              </div>

              <div ref={sentinelRef} aria-hidden className="h-1" />

              {isFetchingNextPage && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </PullToRefresh>

      <MarketFiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} filters={filters} onApply={setFilters} />
    </div>
  );
}
