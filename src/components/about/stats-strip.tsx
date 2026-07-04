import type { LandingStats } from "@/lib/queries/landing-stats";
import { REVIEW_DISPLAY_THRESHOLD } from "@/lib/queries/landing-stats";
import { ScrollReveal } from "./scroll-reveal";

export interface StatsStripProps {
  stats: LandingStats;
}

// Live numbers, always -- never hardcoded, never rounded up to look
// bigger. The reviews stat only shows once there's enough real signal to
// be reassuring rather than embarrassing (see REVIEW_DISPLAY_THRESHOLD).
export function StatsStrip({ stats }: StatsStripProps) {
  const items = [
    { value: stats.hostelCount, label: stats.hostelCount === 1 ? "hostel listed" : "hostels listed" },
    { value: stats.roomOptionCount, label: stats.roomOptionCount === 1 ? "room option" : "room options" },
    ...(stats.reviewCount >= REVIEW_DISPLAY_THRESHOLD
      ? [{ value: stats.reviewCount, label: stats.reviewCount === 1 ? "student review" : "student reviews" }]
      : []),
  ];

  if (items.length === 0) return null;

  return (
    <section className="bg-surface px-4 py-10 sm:px-6">
      <ScrollReveal className="mx-auto grid max-w-5xl grid-cols-2 gap-6 text-center sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <span className="font-display text-display-lg text-gold-600">{item.value.toLocaleString()}</span>
            <span className="text-body-sm text-ink-500">{item.label}</span>
          </div>
        ))}
      </ScrollReveal>
    </section>
  );
}
