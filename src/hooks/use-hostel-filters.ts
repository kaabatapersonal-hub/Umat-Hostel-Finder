"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_FILTERS, type HostelFilters } from "@/lib/queries/hostels";

// Query-param keys, deliberately snake_case to match the RPC's own
// parameter naming (p_near_campus, p_under_budget, ...) rather than the
// camelCase HostelFilters keys.
const BOOLEAN_FILTER_PARAM: Record<
  "nearCampus" | "underBudget" | "availableNow" | "featuredOnly" | "enSuite",
  string
> = {
  nearCampus: "near_campus",
  underBudget: "under_budget",
  availableNow: "available_now",
  featuredOnly: "featured",
  enSuite: "en_suite",
};

// priceMin/priceMax/roomType aren't booleans, so they can't share the
// generic "1" or nothing encoding above -- read/written as their literal
// value instead.
const PRICE_MIN_PARAM = "price_min";
const PRICE_MAX_PARAM = "price_max";
const ROOM_TYPE_PARAM = "room_type";

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
    for (const key of Object.keys(BOOLEAN_FILTER_PARAM) as (keyof typeof BOOLEAN_FILTER_PARAM)[]) {
      if (searchParams.get(BOOLEAN_FILTER_PARAM[key]) === "1") next[key] = true;
    }
    const priceMin = searchParams.get(PRICE_MIN_PARAM);
    const priceMax = searchParams.get(PRICE_MAX_PARAM);
    if (priceMin) next.priceMin = Number(priceMin);
    if (priceMax) next.priceMax = Number(priceMax);
    next.roomType = searchParams.get(ROOM_TYPE_PARAM);
    return next;
  }, [searchParams]);

  function writeFilters(params: URLSearchParams, next: HostelFilters) {
    for (const key of Object.keys(BOOLEAN_FILTER_PARAM) as (keyof typeof BOOLEAN_FILTER_PARAM)[]) {
      const paramKey = BOOLEAN_FILTER_PARAM[key];
      if (next[key]) params.set(paramKey, "1");
      else params.delete(paramKey);
    }
    if (next.priceMin != null) params.set(PRICE_MIN_PARAM, String(next.priceMin));
    else params.delete(PRICE_MIN_PARAM);
    if (next.priceMax != null) params.set(PRICE_MAX_PARAM, String(next.priceMax));
    else params.delete(PRICE_MAX_PARAM);
    if (next.roomType) params.set(ROOM_TYPE_PARAM, next.roomType);
    else params.delete(ROOM_TYPE_PARAM);
  }

  const setFilters = useCallback(
    (next: HostelFilters) => {
      const params = new URLSearchParams(searchParams.toString());
      writeFilters(params, next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // The query string as-is, for building a "View on map" / "View as list"
  // link that carries the current filters to the other route.
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    writeFilters(params, filters);
    return params.toString();
  }, [filters]);

  return { filters, setFilters, queryString };
}
