"use client";

import { Target, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NearHereButtonProps {
  armed: boolean;
  active: boolean;
  onToggleArm: () => void;
  onClear: () => void;
}

// Arms "drop a pin" mode rather than dropping on any map tap -- an
// accidental tap while panning/exploring should never silently plant a
// search point. Once a point is dropped, this becomes a clear button.
export function NearHereButton({ armed, active, onToggleArm, onClear }: NearHereButtonProps) {
  if (active) {
    return (
      <button
        type="button"
        aria-label="Clear dropped pin"
        onClick={onClear}
        className="flex size-11 items-center justify-center rounded-full bg-ink-900 text-white shadow-md"
      >
        <X className="size-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={armed ? "Cancel dropping a pin" : "Drop a pin to search near here"}
      onClick={onToggleArm}
      className={cn(
        "flex size-11 items-center justify-center rounded-full shadow-md transition-colors",
        armed ? "bg-ink-900 text-white" : "bg-surface text-brand-800"
      )}
    >
      <Target className="size-5" />
    </button>
  );
}
