"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { setHostelAvailability } from "@/lib/queries/admin-hostels";

export function useSetHostelAvailability() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, availability }: { id: string; availability: string }) =>
      setHostelAvailability(supabase, id, availability),
    onSuccess: (_void, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-hostels"] });
      queryClient.invalidateQueries({ queryKey: ["hostel", id] });
      queryClient.invalidateQueries({ queryKey: ["hostels"] });
    },
  });
}
