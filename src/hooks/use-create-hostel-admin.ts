"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createHostelAdmin } from "@/lib/queries/admin-hostels";
import type { EditableHostelFields } from "@/lib/hostel-fields";

export function useCreateHostelAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fields: EditableHostelFields) => createHostelAdmin(supabase, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hostels"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["hostels"] });
    },
  });
}
