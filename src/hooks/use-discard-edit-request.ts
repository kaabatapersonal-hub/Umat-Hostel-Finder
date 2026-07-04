"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { discardPendingEditAdmin } from "@/lib/queries/admin-edit-requests";

export function useDiscardEditRequest() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (hostelId: string) => discardPendingEditAdmin(supabase, hostelId),
    onSuccess: (_void, hostelId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-edit-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-hostels"] });
      queryClient.invalidateQueries({ queryKey: ["hostel", hostelId] });
    },
  });
}
