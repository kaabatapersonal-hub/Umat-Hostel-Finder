"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { saveHostel, unsaveHostel, type SaveableHostelInput, type SavedHostel } from "@/lib/queries/saved-hostels";
import { useAuth } from "@/providers/auth-provider";

export function useToggleSave() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const queryKey = ["saved-hostels", user?.id] as const;

  return useMutation({
    mutationFn: async ({ hostel, isSaved }: { hostel: SaveableHostelInput; isSaved: boolean }) => {
      // Re-fetch the user fresh rather than trust the `user` this hook
      // captured at render time — this can run immediately after the auth
      // sheet resolves a sign-in, before React necessarily re-renders with
      // the new user. Supabase's own session state is already correct by
      // then even if our context hasn't caught up yet.
      const {
        data: { user: freshUser },
      } = await supabase.auth.getUser();
      if (!freshUser) throw new Error("Not signed in");

      if (isSaved) {
        await unsaveHostel(supabase, freshUser.id, hostel.id);
      } else {
        await saveHostel(supabase, freshUser.id, hostel);
      }
    },
    onMutate: async ({ hostel, isSaved }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SavedHostel[]>(queryKey);

      queryClient.setQueryData<SavedHostel[]>(queryKey, (old = []) =>
        isSaved
          ? old.filter((h) => h.hostelId !== hostel.id)
          : [
              {
                id: `optimistic-${hostel.id}`,
                hostelId: hostel.id,
                name: hostel.name,
                priceMin: hostel.priceMin,
                priceMax: hostel.priceMax,
                location: hostel.location,
                imageUrl: hostel.imageUrl,
                imageBlur: hostel.imageBlur,
                savedAt: new Date().toISOString(),
              },
              ...old,
            ]
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-hostels"] });
    },
  });
}
