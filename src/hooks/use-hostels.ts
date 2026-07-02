"use client";

import { useMemo } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  getHostels,
  hasActiveFilters,
  type GetHostelsResult,
  type HostelCursor,
  type HostelFilters,
} from "@/lib/queries/hostels";

interface UseHostelsOptions {
  search: string;
  filters: HostelFilters;
  // Seeds the cache for the default (no search, no filters) query so the
  // client doesn't re-fetch what the server already rendered via ISR.
  initialData?: GetHostelsResult;
}

export function useHostels({ search, filters, initialData }: UseHostelsOptions) {
  const supabase = useMemo(() => createClient(), []);
  const trimmedSearch = search.trim();
  const isDefaultQuery = trimmedSearch === "" && !hasActiveFilters(filters);

  return useInfiniteQuery({
    queryKey: ["hostels", trimmedSearch, filters] as const,
    queryFn: ({ pageParam }) =>
      getHostels(supabase, { search: trimmedSearch, filters, cursor: pageParam }),
    initialPageParam: null as HostelCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    initialData: isDefaultQuery && initialData ? { pages: [initialData], pageParams: [null] } : undefined,
    staleTime: isDefaultQuery ? 60_000 : 0,
    retry: 2,
  });
}
