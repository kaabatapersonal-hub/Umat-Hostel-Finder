"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ROOM_TYPE_ORDER, roomTypeLabel } from "@/lib/room-types";
import { DEFAULT_FILTERS, type HostelFilters } from "@/lib/queries/hostels";
import { cn } from "@/lib/utils";

// Same fixed-preset shape as market-filters-sheet.tsx's own price presets --
// a one-tap mobile filter, not a free-form min/max input.
const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Under GHS 500", min: null, max: 500 },
  { label: "GHS 500-1,000", min: 500, max: 1000 },
  { label: "GHS 1,000-2,000", min: 1000, max: 2000 },
  { label: "GHS 2,000+", min: 2000, max: null },
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

export function HostelFiltersSheet({
  open,
  onClose,
  filters,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filters: HostelFilters;
  onApply: (filters: HostelFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);

  // Reset the draft to the live filters every time the sheet opens, same
  // reasoning as MarketFiltersSheet.
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
    setDraft(DEFAULT_FILTERS);
  }

  function handleApply() {
    onApply(draft);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-label label text-ink-500">Price range</span>
          <div className="flex flex-wrap gap-2">
            {PRICE_PRESETS.map((preset) => (
              <Pill key={preset.label} active={isActivePreset(preset)} onClick={() => togglePreset(preset)}>
                {preset.label}
              </Pill>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-label label text-ink-500">Room type</span>
          <div className="flex flex-wrap gap-2">
            {ROOM_TYPE_ORDER.map((roomType) => (
              <Pill
                key={roomType}
                active={draft.roomType === roomType}
                onClick={() => setDraft((prev) => ({ ...prev, roomType: prev.roomType === roomType ? null : roomType }))}
              >
                {roomTypeLabel(roomType)}
              </Pill>
            ))}
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
