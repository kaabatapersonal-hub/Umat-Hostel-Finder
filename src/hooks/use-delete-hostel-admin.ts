"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteHostelAdmin } from "@/lib/queries/admin-hostels";

export function useDeleteHostelAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteHostelAdmin(supabase, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hostels"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["hostels"] });
    },
  });
}
