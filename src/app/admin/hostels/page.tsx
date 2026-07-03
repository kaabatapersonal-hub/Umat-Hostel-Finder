"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertCircle, Building2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { HostelRow } from "@/components/admin/hostel-row";
import { useAdminHostels } from "@/hooks/use-admin-hostels";

export default function AdminHostelsPage() {
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminHostels();
  const hostels = useMemo(() => data?.pages.flatMap((page) => page.hostels) ?? [], [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h1 text-ink-900">Hostels</h1>
        <Link href="/admin/hostels/new">
          <Button variant="accent" size="sm">
            <PlusCircle className="size-4" />
            Add Hostel
          </Button>
        </Link>
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
