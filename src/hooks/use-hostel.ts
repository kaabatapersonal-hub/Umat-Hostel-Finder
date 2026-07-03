"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getHostelById, type HostelDetails } from "@/lib/queries/hostels";

interface UseHostelOptions {
  // undefined -> server didn't provide data, fetch client-side (loading state
  //   shown first).
  // null -> server already confirmed no such hostel exists; skip the network
  //   round trip and go straight to the not-found state.
  // HostelDetails -> server-rendered data, shown immediately and revalidated
  //   in the background.
  initialData?: HostelDetails | null;
  // Set false to skip the fetch entirely (e.g. the edit-listing flow only
  // has a hostelId some of the time, depending on query params present).
  enabled?: boolean;
}

export function useHostel(id: string, { initialData, enabled = true }: UseHostelOptions = {}) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["hostel", id],
    queryFn: () => getHostelById(supabase, id),
    initialData,
    enabled,
    staleTime: 60_000,
    retry: 2,
  });
}
