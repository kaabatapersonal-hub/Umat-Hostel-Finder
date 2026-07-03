"use client";

import { cn } from "@/lib/utils";
import { COMMON_FACILITIES, facilityLabel, facilityIcon } from "@/lib/facilities";
import { ChipInput } from "./chip-input";

export interface FacilitiesPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
}

// Common + custom facilities share one flat facilities[] array (the DB
// makes no distinction between them) -- this component is just two ways
// to add to the same list.
export function FacilitiesPicker({ value, onChange }: FacilitiesPickerProps) {
  const customFacilities = value.filter((f) => !(COMMON_FACILITIES as readonly string[]).includes(f));

  function toggleCommon(facility: string) {
    onChange(value.includes(facility) ? value.filter((f) => f !== facility) : [...value, facility]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {COMMON_FACILITIES.map((facility) => {
          const Icon = facilityIcon(facility);
          const active = value.includes(facility);
          return (
            <button
              key={facility}
              type="button"
              aria-pressed={active}
              onClick={() => toggleCommon(facility)}
              className={cn(
                "flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-body-sm font-medium transition-colors",
                active ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-surface text-ink-500"
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
              {facilityLabel(facility)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label label text-ink-500">Other facilities</span>
        <ChipInput
          value={customFacilities}
          onChange={(nextCustom) => {
            const common = value.filter((f) => (COMMON_FACILITIES as readonly string[]).includes(f));
            onChange([...common, ...nextCustom]);
          }}
          placeholder="e.g. Shared kitchen, Prepaid meter, Study room"
        />
      </div>
    </div>
  );
}
