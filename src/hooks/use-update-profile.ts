"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { updateOwnProfile, type UpdateProfileInput } from "@/lib/queries/profiles";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/components/ui/toast";

// Not query-cache-driven like most mutations in this app -- the
// signed-in user's own profile lives in AuthProvider's plain useState,
// not a TanStack Query cache entry (see auth-provider.tsx), so "make the
// change show up everywhere immediately" means calling refreshProfile()
// on success, not invalidateQueries. The public-profile RPC cache (for
// anyone viewing this user's /profile/{id} page, including the user
// themselves) is a real query key, so that one IS invalidated normally.
export function useUpdateProfile() {
  const { user, refreshProfile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!user) throw new Error("Not signed in");
      await updateOwnProfile(supabase, user.id, input);
    },
    onSuccess: async () => {
      await refreshProfile();
      if (user) queryClient.invalidateQueries({ queryKey: ["public-profile", user.id] });
      showToast({ message: "Profile updated!", variant: "success" });
    },
    onError: () => {
      showToast({ message: "Couldn't save your profile — try again?", variant: "error" });
    },
  });
}
