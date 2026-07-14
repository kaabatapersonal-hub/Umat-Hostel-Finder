"use client";

import { getInitials, formatRelativeTime } from "@/lib/utils";
import { useSellerInfo } from "@/hooks/use-seller-info";
import { Skeleton } from "@/components/ui/skeleton";

export function SellerInfoCard({ sellerId }: { sellerId: string }) {
  const { data, isPending } = useSellerInfo(sellerId);

  if (isPending) return <Skeleton className="h-16 w-full rounded-lg" />;

  const name = data?.profile?.fullName || "Student";
  const joinedAt = data?.profile?.createdAt;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface p-3 shadow-card">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-body-strong text-brand-800">
        {getInitials(name, null)}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-1 text-body-strong text-ink-900">{name}</span>
        <span className="text-caption text-ink-500">
          {joinedAt && `Joined ${formatRelativeTime(joinedAt)} · `}
          {data?.activeListingCount ?? 0} active listing{data?.activeListingCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
