"use client";

import { AlertCircle, PenLine } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EditRequestCard } from "@/components/admin/edit-request-card";
import { useEditRequests } from "@/hooks/use-edit-requests";

export default function AdminEditRequestsPage() {
  const { data: requests, isPending, isError, refetch } = useEditRequests();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-h1 text-ink-900">Edit Requests</h1>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load edit requests"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<PenLine className="size-7" strokeWidth={1.75} />}
          title="No pending edit requests"
          description="When an owner proposes changes to their listing, they'll show up here for review."
          className="bg-surface shadow-card"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((request) => (
            <EditRequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
