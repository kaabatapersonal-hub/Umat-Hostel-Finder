"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { setUserRole } from "@/lib/queries/admin-users";
import type { ProfileRole } from "@/lib/supabase/database.types";

export function useSetUserRole() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProfileRole }) => setUserRole(supabase, userId, role),
    onSuccess: (_void, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    },
  });
}
