import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnalyticsStatCardProps {
  label: string;
  icon: LucideIcon;
  value: number;
  // A fully-formed line under the big number -- "+12 in the last 30 days"
  // or "All time: 1,204" depending on the card, so this component stays a
  // dumb renderer rather than owning date-window formatting logic.
  deltaLabel: string;
  // Only true "+N in the window" deltas get the gold treatment when
  // positive (see brief) -- a card whose small line is contextual info
  // rather than a delta (Sign-ups' "All time: N") passes false here.
  deltaIsPositive?: boolean;
  // Shown as a title attribute on the label -- e.g. Active Users' exact
  // definition ("saved, reviewed, posted, or listed a marketplace item").
  caption?: string;
}

export function AnalyticsStatCard({ label, icon: Icon, value, deltaLabel, deltaIsPositive, caption }: AnalyticsStatCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-ink-500" title={caption}>
          {label}
        </span>
        <Icon className="size-4 text-brand-800" strokeWidth={1.75} />
      </div>
      <span className="font-display text-display text-ink-900">{value.toLocaleString()}</span>
      <span className={cn("text-body-sm", deltaIsPositive ? "text-gold-600" : "text-ink-500")}>{deltaLabel}</span>
    </div>
  );
}

// Same footprint as the real card so a group's skeleton -> content swap
// never shifts layout.
export function AnalyticsStatCardSkeleton() {
  return <div className="h-[104px] w-full animate-pulse rounded-lg bg-surface shadow-card" />;
}

export interface AnalyticsStatCardErrorProps {
  label: string;
  icon: LucideIcon;
}

// A single card failing (e.g. one group's query errored) renders this in
// its place -- never a blank tile, never taking the rest of the panel
// down with it.
export function AnalyticsStatCardError({ label, icon: Icon }: AnalyticsStatCardErrorProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-ink-500">{label}</span>
        <Icon className="size-4 text-ink-300" strokeWidth={1.75} />
      </div>
      <span className="font-display text-display text-ink-300">—</span>
      <span className="text-body-sm text-danger">Couldn&apos;t load</span>
    </div>
  );
}
