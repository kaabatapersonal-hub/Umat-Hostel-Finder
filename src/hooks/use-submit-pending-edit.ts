"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { submitPendingEdit } from "@/lib/queries/hostels";
import type { EditableHostelFields } from "@/lib/hostel-fields";

export function useSubmitPendingEdit() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ hostelId, fields }: { hostelId: string; fields: EditableHostelFields }) =>
      submitPendingEdit(supabase, hostelId, fields),
    onSuccess: (_void, { hostelId }) => {
      queryClient.invalidateQueries({ queryKey: ["my-owned-hostels"] });
      queryClient.invalidateQueries({ queryKey: ["hostel", hostelId] });
    },
  });
}
