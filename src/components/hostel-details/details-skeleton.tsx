import { Skeleton, SkeletonLine } from "@/components/ui/skeleton";

export function DetailsSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="aspect-[4/3] w-full rounded-none sm:aspect-video" />
      <div className="flex flex-col gap-6 px-4 py-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <SkeletonLine className="h-6 w-2/3" />
            <Skeleton className="h-7 w-24 rounded-pill" />
          </div>
          <SkeletonLine className="w-1/2" />
          <SkeletonLine className="w-1/3" />
        </div>
        <div className="flex flex-col gap-2">
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-2/3" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
