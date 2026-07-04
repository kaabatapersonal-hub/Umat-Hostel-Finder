"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// Once-only visibility flag via IntersectionObserver -- backs the related-
// hostels lazy-load (Session 14): the query attached to `inView` shouldn't
// fire until the element genuinely approaches the viewport, so a student
// who leaves before scrolling that far never pays for the fetch. Stops
// observing once true; visibility never needs to un-flip.
export function useInView<T extends Element>(rootMargin = "0px"): { ref: RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setInView(true);
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
