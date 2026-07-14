"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toggleMarketplace } from "@/lib/queries/app-config";
import { MARKETPLACE_ENABLED_QUERY_KEY } from "./use-marketplace-enabled";

// A genuine optimistic update (onMutate flips the cached value immediately,
// onError rolls back) rather than the invalidate-on-success pattern used
// everywhere else in this codebase -- this toggle is explicitly meant to
// feel instant, and the confirm step already in front of it means the
// user has already committed to the action before the mutation even
// fires.
export function useToggleMarketplace() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => toggleMarketplace(supabase),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: MARKETPLACE_ENABLED_QUERY_KEY });
      const previous = queryClient.getQueryData<boolean>(MARKETPLACE_ENABLED_QUERY_KEY);
      queryClient.setQueryData<boolean>(MARKETPLACE_ENABLED_QUERY_KEY, (old) => !old);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context && context.previous !== undefined) {
        queryClient.setQueryData(MARKETPLACE_ENABLED_QUERY_KEY, context.previous);
      }
    },
    onSuccess: (serverValue) => {
      // Reconcile with what the server actually committed -- should match
      // the optimistic flip, but the server's own return value is the
      // source of truth if they ever diverge (e.g. a concurrent toggle).
      queryClient.setQueryData(MARKETPLACE_ENABLED_QUERY_KEY, serverValue);
    },
  });
}
