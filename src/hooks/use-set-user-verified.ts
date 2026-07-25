"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { setUserVerified } from "@/lib/queries/admin-users";

export function useSetUserVerified() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, verified, label }: { userId: string; verified: boolean; label?: string | null }) =>
      setUserVerified(supabase, userId, verified, label),
    onSuccess: (_void, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["verified-profiles"] });
    },
  });
}
