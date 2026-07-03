"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminHostelDetail } from "@/lib/queries/admin-hostels";

export function useAdminHostelDetail(id: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["admin-hostel-detail", id] as const,
    queryFn: () => getAdminHostelDetail(supabase, id),
  });
}
