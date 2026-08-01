import { Star, ShoppingBag, MessageSquare } from "lucide-react";
import type { ProfileStats } from "@/lib/queries/profiles";

export interface Badge {
  key: string;
  label: string;
  icon: typeof Star;
}

// Thresholds only -- no stored "earned badges" table. Recomputed on every
// profile view from get_profile_stats' live counts, so it's always
// accurate and never needs a backfill/migration if a threshold changes.
const BADGE_DEFINITIONS: { key: string; label: string; icon: typeof Star; check: (stats: ProfileStats) => boolean }[] = [
  { key: "first_review", label: "First Review", icon: Star, check: (s) => s.reviewCount >= 1 },
  { key: "trusted_reviewer", label: "Trusted Reviewer", icon: Star, check: (s) => s.reviewCount >= 5 },
  { key: "first_listing", label: "First Listing", icon: ShoppingBag, check: (s) => s.listingCount >= 1 },
  { key: "community_voice", label: "Community Voice", icon: MessageSquare, check: (s) => s.buzzPostCount >= 10 },
];

export function computeBadges(stats: ProfileStats): Badge[] {
  return BADGE_DEFINITIONS.filter((b) => b.check(stats)).map(({ key, label, icon }) => ({ key, label, icon }));
}
