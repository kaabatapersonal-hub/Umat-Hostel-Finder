"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarketplaceEnabled } from "@/hooks/use-marketplace-enabled";
import { useToggleMarketplace } from "@/hooks/use-toggle-marketplace";
import { cn } from "@/lib/utils";

export function MarketplaceToggle() {
  const { data: enabled, isPending } = useMarketplaceEnabled();
  const [confirming, setConfirming] = useState(false);
  const toggle = useToggleMarketplace();

  function handleConfirm() {
    toggle.mutate(undefined, { onSettled: () => setConfirming(false) });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            enabled ? "bg-brand-50 text-brand-800" : "bg-surface-muted text-ink-500"
          )}
        >
          <ShoppingBag className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-body-strong text-ink-900">Student Marketplace</span>
          {!isPending && (
            <span
              className={cn(
                "inline-flex w-fit items-center gap-1.5 rounded-pill px-2 py-0.5 text-caption font-medium",
                enabled ? "bg-brand-50 text-brand-800" : "bg-surface-muted text-ink-500"
              )}
            >
              <span className={cn("size-1.5 rounded-full", enabled ? "bg-brand-600" : "bg-ink-300")} />
              {enabled ? "Live" : "Coming soon"}
            </span>
          )}
        </div>
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-caption text-ink-500">{enabled ? "Disable marketplace?" : "Enable marketplace?"}</span>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="accent" size="sm" onClick={handleConfirm} loading={toggle.isPending}>
            Confirm
          </Button>
        </div>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={!!enabled}
          aria-label={enabled ? "Disable marketplace" : "Enable marketplace"}
          onClick={() => setConfirming(true)}
          disabled={isPending}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
            enabled ? "bg-brand-600" : "bg-ink-300"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-6 rounded-full bg-white shadow-md transition-transform",
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
      )}
    </div>
  );
}
