"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { HostelFilters } from "@/lib/queries/hostels";

const CHIP_CONFIG: { key: keyof HostelFilters; label: string }[] = [
  { key: "nearCampus", label: "Near Campus" },
  { key: "underBudget", label: "Under GHS 2,000" },
  { key: "availableNow", label: "Available Now" },
  { key: "featuredOnly", label: "Featured" },
  { key: "enSuite", label: "En-suite" },
];

export interface FilterChipsProps {
  value: HostelFilters;
  onChange: (next: HostelFilters) => void;
}

export function FilterChips({ value, onChange }: FilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-4">
      {CHIP_CONFIG.map(({ key, label }) => {
        const active = value[key];
        return (
          <motion.button
            key={key}
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => onChange({ ...value, [key]: !active })}
            aria-pressed={active}
            className={cn(
              "shrink-0 rounded-pill border px-3.5 py-1.5 text-body-sm font-medium transition-colors",
              active ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-surface text-ink-500"
            )}
          >
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}
