"use client";

import { MARKET_CATEGORY_CONFIG, MARKET_CATEGORY_ORDER } from "@/lib/market-categories";
import type { MarketCategory } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export function CategoryChips({
  value,
  onChange,
}: {
  value: MarketCategory | null;
  onChange: (category: MarketCategory | null) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1.5 text-body-sm font-medium transition-colors",
          value === null ? "bg-brand-800 text-white" : "bg-surface text-ink-500 shadow-card hover:bg-surface-muted"
        )}
      >
        All
      </button>
      {MARKET_CATEGORY_ORDER.map((category) => {
        const config = MARKET_CATEGORY_CONFIG[category];
        const Icon = config.icon;
        const active = value === category;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(active ? null : category)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1.5 text-body-sm font-medium transition-colors",
              active ? "bg-brand-800 text-white" : "bg-surface text-ink-500 shadow-card hover:bg-surface-muted"
            )}
          >
            <Icon className="size-3.5" />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
