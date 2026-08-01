"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Building2, Download, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { HostelRow } from "@/components/admin/hostel-row";
import { useAdminHostels } from "@/hooks/use-admin-hostels";
import { getAdminHostels } from "@/lib/queries/admin-hostels";
import { downloadCsv } from "@/lib/csv-export";
import { createClient } from "@/lib/supabase/client";

export default function AdminHostelsPage() {
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminHostels();
  const hostels = useMemo(() => data?.pages.flatMap((page) => page.hostels) ?? [], [data]);
  const [exporting, setExporting] = useState(false);

  // Same "export the full table, not just what's paginated in memory"
  // reasoning as the Users export.
  async function handleExport() {
    setExporting(true);
    try {
      const supabase = createClient();
      const { hostels: allHostels } = await getAdminHostels(supabase, { limit: 10000 });
      downloadCsv(
        `campa-hostels-${new Date().toISOString().slice(0, 10)}.csv`,
        allHostels,
        [
          { header: "Name", value: (h) => h.name },
          { header: "Location", value: (h) => h.location },
          { header: "Price Min", value: (h) => h.priceMin },
          { header: "Price Max", value: (h) => h.priceMax },
          { header: "Availability", value: (h) => h.availability },
          { header: "Featured", value: (h) => h.featured },
          { header: "Rating Avg", value: (h) => h.ratingAvg },
          { header: "Rating Count", value: (h) => h.ratingCount },
          { header: "Has Pending Edit", value: (h) => h.hasPendingEdit },
          { header: "Has Coordinates", value: (h) => h.hasCoordinates },
        ]
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-h1 text-ink-900">Hostels</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
          <Link href="/admin/hostels/new">
            <Button variant="accent" size="sm">
              <PlusCircle className="size-4" />
              Add Hostel
            </Button>
          </Link>
        </div>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
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
          title="No hostels yet"
          description="Add your first live hostel to get started."
          actionLabel="Add Hostel"
          onAction={() => {
            window.location.href = "/admin/hostels/new";
          }}
          className="bg-surface shadow-card"
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {hostels.map((hostel) => (
              <HostelRow key={hostel.id} hostel={hostel} />
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
