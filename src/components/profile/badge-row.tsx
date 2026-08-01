import { computeBadges } from "@/lib/badges";
import type { ProfileStats } from "@/lib/queries/profiles";

// Milestone badges only (no points/leaderboard) -- recomputed from live
// counts every render, nothing stored. Renders nothing at all if the
// student hasn't earned any yet, rather than an empty "Badges" heading.
export function BadgeRow({ stats }: { stats: ProfileStats | undefined }) {
  const badges = stats ? computeBadges(stats) : [];
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map(({ key, label, icon: Icon }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-pill bg-gold-50 px-2.5 py-1 text-caption font-medium text-gold-600"
        >
          <Icon className="size-3" />
          {label}
        </span>
      ))}
    </div>
  );
}
