"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMapHostels } from "@/lib/queries/map-hostels";

export function useMapHostels() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["map-hostels"] as const,
    queryFn: () => getMapHostels(supabase),
    staleTime: 60_000,
    retry: 2,
  });
}
