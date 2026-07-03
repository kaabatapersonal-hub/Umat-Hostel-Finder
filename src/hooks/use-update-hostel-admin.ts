"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { updateHostelAdmin } from "@/lib/queries/admin-hostels";
import type { EditableHostelFields } from "@/lib/hostel-fields";

export function useUpdateHostelAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: EditableHostelFields }) => updateHostelAdmin(supabase, id, fields),
    onSuccess: (_void, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-hostels"] });
      queryClient.invalidateQueries({ queryKey: ["admin-hostel-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["hostel", id] });
      queryClient.invalidateQueries({ queryKey: ["hostels"] });
    },
  });
}
