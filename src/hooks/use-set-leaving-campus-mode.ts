"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { setLeavingCampusMode } from "@/lib/queries/market";

export function useSetLeavingCampusMode(userId: string | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ enabled, leavingDate }: { enabled: boolean; leavingDate: string | null }) =>
      setLeavingCampusMode(supabase, enabled, leavingDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leaving-mode", userId] });
      queryClient.invalidateQueries({ queryKey: ["my-market-listings", userId] });
      queryClient.invalidateQueries({ queryKey: ["seller-listings", userId] });
      queryClient.invalidateQueries({ queryKey: ["market-feed"] });
    },
  });
}
