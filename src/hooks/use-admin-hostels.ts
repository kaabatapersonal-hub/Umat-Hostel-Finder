"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminHostels } from "@/lib/queries/admin-hostels";

export function useAdminHostels() {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["admin-hostels"] as const,
    queryFn: ({ pageParam }) => getAdminHostels(supabase, { offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}
