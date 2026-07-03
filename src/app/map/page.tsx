"use client";

import { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Map as MapIcon, AlertCircle, List, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/hostels/filter-chips";
import { useMapHostels } from "@/hooks/use-map-hostels";
import { useHostelFilters } from "@/hooks/use-hostel-filters";
import { useUserLocation } from "@/hooks/use-user-location";
import { hostelMatchesFilters } from "@/lib/hostel-filters";
import { DEFAULT_FILTERS } from "@/lib/queries/hostels";

// Leaflet touches `window` and must never be part of the server render --
// ssr:false is the load-bearing part here. This also keeps the Leaflet
// bundle out of every other route's initial JS; it only loads when someone
// actually opens the Map tab.
const HostelMap = dynamic(() => import("@/components/map/hostel-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-muted">
      <div className="flex flex-col items-center gap-2 text-ink-500">
        <MapIcon className="size-6 animate-pulse" strokeWidth={1.5} />
        <span className="text-body-sm">Loading map…</span>
      </div>
    </div>
  );
}

function MapPageContent() {
  const { data: hostels, isPending, isError, refetch } = useMapHostels();
  const { filters, setFilters, queryString } = useHostelFilters();
  const userLocation = useUserLocation();
  const searchParams = useSearchParams();
  const focusHostelId = searchParams.get("hostelId");

  const filteredHostels = useMemo(
    () => (hostels ?? []).filter((hostel) => hostelMatchesFilters(hostel, filters)),
    [hostels, filters]
  );

  const totalMapped = hostels?.length ?? 0;
  const count = filteredHostels.length;
  const listHref = queryString ? `/?${queryString}` : "/";

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Map"
        subtitle={isPending ? "Loading hostels near UMaT…" : `${count} hostel${count === 1 ? "" : "s"} near UMaT`}
        action={
          <Link
            href={listHref}
            className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-body-sm font-medium text-brand-800 shadow-card"
          >
            <List className="size-4" />
            List
          </Link>
        }
      />

      <FilterChips value={filters} onChange={setFilters} />

      {(userLocation.status === "denied" || userLocation.status === "unavailable") && userLocation.message && (
        <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-md bg-surface-muted px-3.5 py-2.5 text-body-sm text-ink-500">
          <span>{userLocation.message}</span>
          <button type="button" aria-label="Dismiss" onClick={userLocation.clear} className="shrink-0 text-ink-300">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="relative mx-4 h-[70vh] min-h-96 overflow-hidden rounded-lg shadow-card">
        {isPending ? (
          <MapSkeleton />
        ) : isError ? (
          <div className="flex h-full w-full items-center justify-center bg-surface-muted px-6">
            <EmptyState
              icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
              title="Couldn't load the map"
              description="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => refetch()}
            />
          </div>
        ) : totalMapped === 0 ? (
          <div className="flex h-full w-full items-center justify-center bg-surface-muted px-6">
            <EmptyState
              icon={<MapIcon className="size-7" strokeWidth={1.75} />}
              title="Hostel locations coming soon"
              description="We're plotting real coordinates for every hostel around UMaT."
            />
          </div>
        ) : count === 0 ? (
          <div className="flex h-full w-full items-center justify-center bg-surface-muted px-6">
            <EmptyState
              icon={<MapIcon className="size-7" strokeWidth={1.75} />}
              title="No hostels match those filters"
              description="Try clearing a few filters to see more pins."
              actionLabel="Clear filters"
              onAction={() => setFilters(DEFAULT_FILTERS)}
            />
          </div>
        ) : (
          <HostelMap
            hostels={filteredHostels}
            focusHostelId={focusHostelId}
            userPosition={userLocation.position}
            userAccuracy={userLocation.accuracy}
            userStatus={userLocation.status}
            onLocate={userLocation.locate}
          />
        )}
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={null}>
      <MapPageContent />
    </Suspense>
  );
}
