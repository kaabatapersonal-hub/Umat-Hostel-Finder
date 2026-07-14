"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { conditionLabel, MARKET_CONDITION_ORDER, SERVICE_TYPE_ORDER, serviceTypeLabel } from "@/lib/market-categories";
import { DEFAULT_MARKET_FILTERS, type MarketFeedFilters, type MarketSort } from "@/lib/queries/market";
import type { MarketCondition } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: MarketSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

// A fixed set of price presets, not a free-form min/max range input --
// keeps this a one-tap mobile filter rather than a small form of its own.
const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Under GHS 50", min: null, max: 50 },
  { label: "GHS 50-200", min: 50, max: 200 },
  { label: "GHS 200+", min: 200, max: null },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill px-3 py-1.5 text-body-sm font-medium transition-colors",
        active ? "bg-brand-800 text-white" : "bg-surface-muted text-ink-500"
      )}
    >
      {children}
    </button>
  );
}

export function MarketFiltersSheet({
  open,
  onClose,
  filters,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filters: MarketFeedFilters;
  onApply: (filters: MarketFeedFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);

  // Reset the draft to the live filters every time the sheet opens, so
  // dismissing without applying never leaks a half-edited draft into the
  // next open.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  function isActivePreset(preset: (typeof PRICE_PRESETS)[number]): boolean {
    return draft.priceMin === preset.min && draft.priceMax === preset.max;
  }

  function togglePreset(preset: (typeof PRICE_PRESETS)[number]) {
    setDraft((prev) =>
      isActivePreset(preset) ? { ...prev, priceMin: null, priceMax: null } : { ...prev, priceMin: preset.min, priceMax: preset.max }
    );
  }

  function handleClear() {
    setDraft(DEFAULT_MARKET_FILTERS);
  }

  function handleApply() {
    onApply(draft);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-label label text-ink-500">Sort by</span>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((option) => (
              <Pill key={option.value} active={draft.sort === option.value} onClick={() => setDraft((prev) => ({ ...prev, sort: option.value }))}>
                {option.label}
              </Pill>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-label label text-ink-500">Price</span>
          <div className="flex flex-wrap gap-2">
            {PRICE_PRESETS.map((preset) => (
              <Pill key={preset.label} active={isActivePreset(preset)} onClick={() => togglePreset(preset)}>
                {preset.label}
              </Pill>
            ))}
            <Pill active={!!draft.freeOnly} onClick={() => setDraft((prev) => ({ ...prev, freeOnly: !prev.freeOnly }))}>
              Free items
            </Pill>
          </div>
        </div>

        {draft.category === "services" ? (
          // Condition/price-range don't mean anything for a service --
          // browsing "Services" filters by what's on offer instead.
          <div className="flex flex-col gap-2">
            <span className="text-label label text-ink-500">Service type</span>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPE_ORDER.map((serviceType) => (
                <Pill
                  key={serviceType}
                  active={draft.serviceType === serviceType}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, serviceType: prev.serviceType === serviceType ? null : serviceType }))
                  }
                >
                  {serviceTypeLabel(serviceType)}
                </Pill>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-label label text-ink-500">Condition</span>
            <div className="flex flex-wrap gap-2">
              {MARKET_CONDITION_ORDER.map((condition) => (
                <Pill
                  key={condition}
                  active={draft.condition === condition}
                  onClick={() => setDraft((prev) => ({ ...prev, condition: prev.condition === condition ? null : (condition as MarketCondition) }))}
                >
                  {conditionLabel(condition)}
                </Pill>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-label label text-ink-500">Leaving Campus</span>
          <div className="flex flex-wrap gap-2">
            <Pill
              active={!!draft.leavingSaleOnly}
              onClick={() => setDraft((prev) => ({ ...prev, leavingSaleOnly: !prev.leavingSaleOnly }))}
            >
              Leaving Sales only
            </Pill>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" onClick={handleClear} className="flex-1">
            Clear all
          </Button>
          <Button variant="accent" onClick={handleApply} className="flex-1">
            Apply
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
