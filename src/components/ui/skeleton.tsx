import { cn } from "@/lib/utils";

const shimmer =
  "relative overflow-hidden bg-surface-muted before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-line/60 before:to-transparent motion-reduce:before:animate-none";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(shimmer, "rounded-sm", className)} {...props} />;
}

export function SkeletonLine({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-3.5 w-full rounded-sm", className)} {...props} />;
}

export function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg bg-surface shadow-card overflow-hidden", className)} {...props}>
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <SkeletonLine className="w-3/4" />
        <SkeletonLine className="w-1/2" />
        <SkeletonLine className="w-1/3" />
      </div>
    </div>
  );
}

// Shape-matches the thumbnail + two-line rows used across Saved, Profile,
// and Admin lists (SavedHostelRow, HostelRow, SubmissionRow, ...) instead
// of a single generic gray bar.
export function SkeletonRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-3 rounded-md border border-line bg-surface p-3", className)}
      {...props}
    >
      <Skeleton className="size-16 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <SkeletonLine className="w-2/3" />
        <SkeletonLine className="w-1/3" />
      </div>
    </div>
  );
}

// Shape-matches CompactHostelRow (the desktop details sidebar's "More
// hostels" card) -- a wider thumbnail than SkeletonRow, three lines.
export function SkeletonCompactRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex gap-3 p-1.5", className)} {...props}>
      <Skeleton className="aspect-video w-32 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-2/3" />
        <SkeletonLine className="w-1/2" />
      </div>
    </div>
  );
}
