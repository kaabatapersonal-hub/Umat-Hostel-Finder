"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { setUserSuspended } from "@/lib/queries/admin-users";

export function useSetUserSuspended() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, suspended }: { userId: string; suspended: boolean }) => setUserSuspended(supabase, userId, suspended),
    onSuccess: (_void, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    },
  });
}
