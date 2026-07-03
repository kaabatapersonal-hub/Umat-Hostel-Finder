"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { setHostelFeatured, type FeaturedUpdate } from "@/lib/queries/admin-hostels";

export function useSetHostelFeatured() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: FeaturedUpdate }) => setHostelFeatured(supabase, id, update),
    onSuccess: (_void, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-hostels"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["hostel", id] });
      queryClient.invalidateQueries({ queryKey: ["hostels"] });
    },
  });
}
