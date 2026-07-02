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
