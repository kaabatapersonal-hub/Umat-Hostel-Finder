"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getBuzzPostById } from "@/lib/queries/buzz";

export function useBuzzPost(id: string) {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["buzz-post", id] as const,
    queryFn: () => getBuzzPostById(supabase, id),
  });
}
