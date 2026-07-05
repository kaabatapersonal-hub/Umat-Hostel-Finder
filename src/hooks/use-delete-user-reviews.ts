"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteUserReviews } from "@/lib/queries/admin-users";

// Bulk delete -- "one account, several abusive reviews across hostels."
export function useDeleteUserReviews() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => deleteUserReviews(supabase, userId),
    onSuccess: (_count, userId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-reported-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}
