"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "@/hooks/use-in-view";
import { useRelatedHostels } from "@/hooks/use-related-hostels";
import { HostelCard } from "@/components/hostels/hostel-card";
import { SkeletonCard } from "@/components/ui/skeleton";

const PAGE_SIZE = 6;
// One fetch for the whole related set (cheap at today's catalog size --
// see getRelatedHostels), then revealed progressively client-side rather
// than issuing a fresh network request per "page".
const CANDIDATE_LIMIT = 24;

export interface RelatedHostelsSectionProps {
  hostelId: string;
  location: string;
  priceMin: number | null;
}

// The mobile "endless discovery" continuation: hidden entirely at desktop
// (lg:hidden) where the sidebar already covers this job -- appending both
// would be redundant. Lazy-loads only once the user scrolls near the end
// of the page (see useInView's rootMargin below), so a student who
// contacts the manager and leaves never pays for content they didn't see.
export function RelatedHostelsSection({ hostelId, location, priceMin }: RelatedHostelsSectionProps) {
  const { ref, inView } = useInView<HTMLDivElement>("600px");
  const { data: related, isPending } = useRelatedHostels({
    hostelId,
    location,
    priceMin,
    limit: CANDIDATE_LIMIT,
    enabled: inView,
  });

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const visible = related?.slice(0, visibleCount) ?? [];
  const hasMore = !!related && visibleCount < related.length;

  // Reveals more of the already-fetched array as the user scrolls near
  // the bottom -- no new network request per "page", so there's nothing
  // to double-fire the way Home's real pagination guards against.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => count + PAGE_SIZE);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <section ref={ref} className="flex flex-col gap-4 px-4 pt-6 pb-8 lg:hidden">
      <h2 className="font-display text-h1 text-ink-900">More hostels near UMaT</h2>

      {!inView || isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visible.map((hostel, i) => (
            <HostelCard key={hostel.id} hostel={hostel} index={i} />
          ))}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} aria-hidden className="h-1" />}
    </section>
  );
}
