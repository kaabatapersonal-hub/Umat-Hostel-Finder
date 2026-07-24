"use client";

import { useQuery } from "@tanstack/react-query";
import { searchGifs } from "@/lib/queries/gifs";

// No query -> Klipy's trending endpoint (the picker's pre-loaded state),
// same query key shape either way so switching between them is just a
// normal cache-key change, not a special empty/loading case to hand-code.
export function useGifSearch(query: string, enabled: boolean) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["gif-search", trimmed] as const,
    queryFn: () => searchGifs(trimmed),
    enabled,
    staleTime: 60_000,
  });
}
