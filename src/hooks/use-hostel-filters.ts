"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_FILTERS, type HostelFilters } from "@/lib/queries/hostels";

// Query-param keys, deliberately snake_case to match the RPC's own
// parameter naming (p_near_campus, p_under_budget, ...) rather than the
// camelCase HostelFilters keys.
const FILTER_PARAM: Record<keyof HostelFilters, string> = {
  nearCampus: "near_campus",
  underBudget: "under_budget",
  availableNow: "available_now",
  featuredOnly: "featured",
  enSuite: "en_suite",
};

// Filters live in the URL (not a Context/store) so the feed and the map
// (Session 9.5) read/write the exact same state without either owning it,
// and so a "View on map" / "View as list" link can carry the current
// filters just by copying the query string across routes.
export function useHostelFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<HostelFilters>(() => {
    const next = { ...DEFAULT_FILTERS };
    for (const key of Object.keys(FILTER_PARAM) as (keyof HostelFilters)[]) {
      if (searchParams.get(FILTER_PARAM[key]) === "1") next[key] = true;
    }
    return next;
  }, [searchParams]);

  const setFilters = useCallback(
    (next: HostelFilters) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of Object.keys(FILTER_PARAM) as (keyof HostelFilters)[]) {
        const paramKey = FILTER_PARAM[key];
        if (next[key]) params.set(paramKey, "1");
        else params.delete(paramKey);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // The query string as-is, for building a "View on map" / "View as list"
  // link that carries the current filters to the other route.
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    for (const key of Object.keys(FILTER_PARAM) as (keyof HostelFilters)[]) {
      if (filters[key]) params.set(FILTER_PARAM[key], "1");
    }
    return params.toString();
  }, [filters]);

  return { filters, setFilters, queryString };
}
