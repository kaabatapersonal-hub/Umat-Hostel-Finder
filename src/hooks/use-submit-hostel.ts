"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createSubmission, type CreateSubmissionInput } from "@/lib/queries/submissions";

export type SubmitHostelVars = Omit<CreateSubmissionInput, "submittedBy">;

export function useSubmitHostel() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitHostelVars) => {
      // Re-fetch fresh rather than trust context -- this can run right
      // after the auth sheet resolves a sign-in, before React necessarily
      // re-renders with the new user (see the identical pattern in
      // useToggleSave and useSubmitReview).
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      return createSubmission(supabase, { ...input, submittedBy: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
    },
  });
}
