"use client";

import { AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmitHostelForm } from "@/components/submit/submit-hostel-form";
import { AvailabilitySelect } from "./availability-select";
import { FeaturedEditor } from "./featured-editor";
import { useAdminHostelDetail } from "@/hooks/use-admin-hostel-detail";

export function AdminEditHostelView({ id }: { id: string }) {
  const { data: hostel, isPending, isError, refetch } = useAdminHostelDetail(id);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !hostel) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
        title={isError ? "Couldn't load this hostel" : "Hostel not found"}
        description={isError ? "Check your connection and try again." : "It may have already been deleted."}
        actionLabel={isError ? "Retry" : undefined}
        onAction={isError ? () => refetch() : undefined}
        className="bg-surface shadow-card"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h1 text-ink-900">Edit: {hostel.name}</h1>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface p-4 shadow-card">
        <span className="text-body-sm font-medium text-ink-500">Status</span>
        <AvailabilitySelect hostelId={hostel.id} availability={hostel.availability} />
        <FeaturedEditor hostelId={hostel.id} featured={hostel.featured} featuredUntil={hostel.featuredUntil} isPaid={hostel.isPaid} />
      </div>

      <SubmitHostelForm mode={{ kind: "admin-edit", hostelId: hostel.id }} initialValues={hostel} />
    </div>
  );
}
