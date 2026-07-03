"use client";

import dynamic from "next/dynamic";
import { Map as MapIcon, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useMapHostels } from "@/hooks/use-map-hostels";

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

export default function MapPage() {
  const { data: hostels, isPending, isError, refetch } = useMapHostels();
  const count = hostels?.length ?? 0;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Map"
        subtitle={isPending ? "Loading hostels near UMaT…" : `${count} hostel${count === 1 ? "" : "s"} near UMaT`}
      />

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
        ) : count === 0 ? (
          <div className="flex h-full w-full items-center justify-center bg-surface-muted px-6">
            <EmptyState
              icon={<MapIcon className="size-7" strokeWidth={1.75} />}
              title="Hostel locations coming soon"
              description="We're plotting real coordinates for every hostel around UMaT."
            />
          </div>
        ) : (
          <HostelMap hostels={hostels} />
        )}
      </div>
    </div>
  );
}
