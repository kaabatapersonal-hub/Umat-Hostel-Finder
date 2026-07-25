"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAppConfigString } from "@/lib/queries/app-config";

// Same "the number that's on the other end of every wa.me link the
// managers-section marketing page hardcodes" as MANAGER_CONTACT_WHATSAPP
// -- pulled from app_config instead so it can change without a deploy
// (see the Session 22 Part 3 migration's own comment).
const FALLBACK_TEAM_WHATSAPP = "233257653283";

export function useTeamWhatsApp() {
  const supabase = useMemo(() => createClient(), []);

  return useQuery({
    queryKey: ["team-whatsapp"] as const,
    queryFn: () => getAppConfigString(supabase, "team_whatsapp", FALLBACK_TEAM_WHATSAPP),
    staleTime: 5 * 60_000,
  });
}
