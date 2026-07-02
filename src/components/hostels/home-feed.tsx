"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, Building2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { FilterChips } from "./filter-chips";
import { HostelCard } from "./hostel-card";
import { useHostels } from "@/hooks/use-hostels";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  DEFAULT_FILTERS,
  hasActiveFilters,
  type GetHostelsResult,
  type HostelFilters,
} from "@/lib/queries/hostels";

export function HomeFeed({ initialData }: { initialData?: GetHostelsResult }) {
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<HostelFilters>(DEFAULT_FILTERS);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

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
  // pagination) animates normally.
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
    <div className="flex flex-col">
      <section className="bg-brand-800 px-4 pt-8 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="label text-caption text-gold-500">UMaT · Tarkwa</span>
            <h1 className="font-display text-display-lg text-white">Find your next hostel</h1>
          </div>
          <Button variant="accent" size="sm" className="mt-1 shrink-0">
            Submit Hostel
          </Button>
        </div>

        <div className="mt-5 flex items-center gap-2">
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
          <button
            type="button"
            aria-label="Filters"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface text-brand-800 shadow-card"
          >
            <SlidersHorizontal className="size-5" />
          </button>
        </div>
      </section>

      <FilterChips value={filters} onChange={setFilters} />

      <section className="flex flex-col gap-4 px-4 pb-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-h1 text-ink-900">Hostels near you</h2>
        </div>

        {isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {hostels.map((hostel, i) => (
                <HostelCard key={hostel.id} hostel={hostel} index={i} animateIn={!isFirstPaintRef.current} />
              ))}
            </div>
            <div ref={sentinelRef} aria-hidden className="h-1" />
            {isFetchingNextPage && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
