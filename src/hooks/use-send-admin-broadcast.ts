"use client";

import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { sendAdminBroadcast } from "@/lib/queries/notifications";

export function useSendAdminBroadcast() {
  const supabase = useMemo(() => createClient(), []);

  return useMutation({
    mutationFn: (vars: { title: string; body: string; link?: string | null }) => sendAdminBroadcast(supabase, vars),
  });
}
