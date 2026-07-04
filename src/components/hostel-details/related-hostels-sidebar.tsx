"use client";

import { useInView } from "@/hooks/use-in-view";
import { useRelatedHostels } from "@/hooks/use-related-hostels";
import { CompactHostelRow } from "@/components/hostels/compact-hostel-row";
import { SkeletonCompactRow } from "@/components/ui/skeleton";

export interface RelatedHostelsSidebarProps {
  hostelId: string;
  location: string;
  priceMin: number | null;
}

// The desktop "watch page" sidebar -- never blocks the main column: the
// query only enables once the sidebar itself is visible (near-immediate
// on a normal desktop viewport, since it sits beside the fold, not below
// it), and renders nothing at all if there's simply nothing to relate to
// yet rather than an empty box.
export function RelatedHostelsSidebar({ hostelId, location, priceMin }: RelatedHostelsSidebarProps) {
  const { ref, inView } = useInView<HTMLDivElement>("200px");
  const { data: related, isPending } = useRelatedHostels({
    hostelId,
    location,
    priceMin,
    limit: 10,
    enabled: inView,
  });

  return (
    <div ref={ref} className="flex flex-col gap-1">
      <h2 className="mb-2 font-display text-h2 text-ink-900">More hostels</h2>

      {!inView || isPending ? (
        <div className="flex flex-col gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCompactRow key={i} />
          ))}
        </div>
      ) : related && related.length > 0 ? (
        related.map((hostel) => <CompactHostelRow key={hostel.id} hostel={hostel} />)
      ) : null}
    </div>
  );
}
