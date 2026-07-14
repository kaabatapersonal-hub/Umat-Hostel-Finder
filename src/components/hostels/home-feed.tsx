"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Building2, AlertCircle, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { MarketBanner } from "@/components/market/market-banner";
import { FilterChips } from "./filter-chips";
import { HostelCard } from "./hostel-card";
import { useHostels } from "@/hooks/use-hostels";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuth } from "@/providers/auth-provider";
import { useHostelFilters } from "@/hooks/use-hostel-filters";
import { DEFAULT_FILTERS, hasActiveFilters, type GetHostelsResult } from "@/lib/queries/hostels";

export function HomeFeed({ initialData }: { initialData?: GetHostelsResult }) {
  const [searchInput, setSearchInput] = useState("");
  // URL-synced (Session 9.5) so the Map tab reads/writes the exact same
  // filter state -- see hooks/use-hostel-filters.ts.
  const { filters, setFilters, queryString } = useHostelFilters();
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const router = useRouter();
  const { requireAuth } = useAuth();

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useHostels({
    search: debouncedSearch,
    filters,
    initialData,
  });

  const hostels = useMemo(() => data?.pages.flatMap((page) => page.hostels) ?? [], [data]);
  const isFiltering = debouncedSearch !== "" || hasActiveFilters(filters);

  // True only during the very first render. Cards rendered then are either
  // already part of the server-sent HTML (SSR initialData) or, if not,
  // appear after hydration has clearly already completed — either way they
  // shouldn't run a mount fade-in (see HostelCard's animateIn prop). Flips
  // to false right after mount, so every later render (search, filters,
  // pagination) animates normally. Pre-existing react-hooks/refs lint
  // finding, not introduced this session -- see the identical note on
  // HostelDetailsView; a setState-in-effect rewrite just trades it for the
  // sibling rule, with an extra render pass and no actual benefit.
  const isFirstPaintRef = useRef(true);
  useEffect(() => {
    isFirstPaintRef.current = false;
  }, []);

  // Sentinel-based infinite scroll. fetchingRef guards against the
  // observer firing again before React re-renders isFetchingNextPage.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    fetchingRef.current = isFetchingNextPage;
  }, [isFetchingNextPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !fetchingRef.current) {
          fetchingRef.current = true;
          fetchNextPage();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage]);

  function clearFilters() {
    setSearchInput("");
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <PullToRefresh onRefresh={() => refetch()}>
    <div className="flex flex-col">
      {/* The one brand moment: a quiet dark-to-deeper-green gradient so the
          hero reads as a considered surface, not a flat color bar. The only
          gradient in the app -- everywhere else stays flat by design. */}
      <section className="bg-gradient-to-br from-brand-800 to-brand-900 px-4 pt-8 pb-6 lg:px-6">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="label text-caption text-gold-500">UMaT · Tarkwa</span>
            <h1 className="font-display text-display-lg text-white">Find your next hostel</h1>
          </div>
          <Button
            variant="accent"
            size="sm"
            className="mt-1 shrink-0"
            onClick={() => requireAuth(() => router.push("/submit"))}
          >
            Submit Hostel
          </Button>
        </div>

        <div className="mx-auto mt-5 flex max-w-7xl items-center gap-2">
          <div className="flex h-12 flex-1 items-center gap-2.5 rounded-md bg-surface px-3.5 shadow-card">
            <Search className="size-5 shrink-0 text-ink-300" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search hostels, areas..."
              aria-label="Search hostels"
              className="w-full bg-transparent text-body text-ink-900 placeholder:text-ink-300 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 pt-4 lg:px-6">
        <MarketBanner />
      </div>

      <div className="mx-auto w-full max-w-7xl">
        <FilterChips value={filters} onChange={setFilters} />
      </div>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-6 lg:px-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-h1 text-ink-900">Hostels near you</h2>
          <Link
            href={queryString ? `/map?${queryString}` : "/map"}
            className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-body-sm font-medium text-brand-800 shadow-card"
          >
            <MapIcon className="size-4" />
            Map
          </Link>
        </div>

        {isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
            title="Couldn't load hostels"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => refetch()}
            className="bg-surface shadow-card"
          />
        ) : hostels.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-7" strokeWidth={1.75} />}
            title={isFiltering ? "No hostels match those filters" : "No hostels listed yet"}
            description={
              isFiltering
                ? "Try clearing a few filters or searching something else."
                : "Check back soon — new hostels are added regularly."
            }
            actionLabel={isFiltering ? "Clear filters" : undefined}
            onAction={isFiltering ? clearFilters : undefined}
            className="bg-surface shadow-card"
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-8">
              {hostels.map((hostel, i) => (
                <HostelCard key={hostel.id} hostel={hostel} index={i} animateIn={!isFirstPaintRef.current} />
              ))}
            </div>
            <div ref={sentinelRef} aria-hidden className="h-1" />
            {isFetchingNextPage && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-8">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            )}
          </>
        )}
      </section>
    </div>
    </PullToRefresh>
  );
}
