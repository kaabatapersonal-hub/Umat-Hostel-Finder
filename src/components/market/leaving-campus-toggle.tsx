"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlaneTakeoff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { useMyLeavingMode } from "@/hooks/use-my-leaving-mode";
import { useSetLeavingCampusMode } from "@/hooks/use-set-leaving-campus-mode";
import { cn } from "@/lib/utils";

// Same inline-switch shape as MarketplaceToggle -- a confirm step in front
// of a plain on/off switch, no modal. Turning this ON bulk-sets
// is_leaving_sale on every one of the student's active listings (see
// set_leaving_campus_mode); turning it OFF bulk-clears it. The optional
// leaving date is only editable while the mode is ON.
export function LeavingCampusToggle() {
  const { user } = useAuth();
  const { data, isPending } = useMyLeavingMode(user?.id);
  const setMode = useSetLeavingCampusMode(user?.id);
  const [confirming, setConfirming] = useState<"on" | "off" | null>(null);
  const [dateInput, setDateInput] = useState("");

  useEffect(() => {
    setDateInput(data?.leavingDate ?? "");
  }, [data?.leavingDate]);

  if (!user || isPending) return null;

  const enabled = !!data?.isLeavingSale;

  function handleConfirm() {
    setMode.mutate(
      { enabled: !enabled, leavingDate: !enabled ? dateInput || null : null },
      { onSettled: () => setConfirming(null) }
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              enabled ? "bg-gold-50 text-gold-600" : "bg-surface-muted text-ink-500"
            )}
          >
            <PlaneTakeoff className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-body-strong text-ink-900">Leaving Campus Sale</span>
            <span className="text-caption text-ink-500">Bundle all your items into one shareable sale page</span>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? "Turn off Leaving Campus Sale" : "Turn on Leaving Campus Sale"}
          onClick={() => setConfirming(enabled ? "off" : "on")}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            enabled ? "bg-gold-500" : "bg-ink-300"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-6 rounded-full bg-white shadow-md transition-transform",
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {confirming && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <p className="text-body-sm text-ink-500">
            {confirming === "on"
              ? "This groups all your active listings into one shareable sale page. New listings will join automatically until you turn it off."
              : "Your active listings will no longer be marked as part of a leaving sale. Your sale page stays up, just without the \"leaving\" framing."}
          </p>
          {confirming === "on" && (
            <Input
              type="date"
              label="Leaving date (optional)"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button variant="accent" size="sm" onClick={handleConfirm} loading={setMode.isPending}>
              {confirming === "on" ? "Activate" : "Turn off"}
            </Button>
          </div>
        </div>
      )}

      {enabled && !confirming && (
        <Link href={`/market/seller/${user.id}`} className="text-body-sm text-brand-800 underline underline-offset-2">
          View your sale page →
        </Link>
      )}
    </div>
  );
}
