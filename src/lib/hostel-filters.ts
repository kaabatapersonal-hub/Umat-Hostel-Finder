import type { HostelFilters } from "@/lib/queries/hostels";

export interface FilterableHostel {
  tags: string[];
  priceMin: number | null;
  availability: string;
  isActivelyFeatured: boolean;
  facilities: string[];
}

// The "Under GHS 2,000" threshold, kept in one place. Mirrors the literal
// `2000` in get_hostel_feed()'s WHERE clause (Session 4.5 migration) --
// change both together if this ever needs to move.
const UNDER_BUDGET_THRESHOLD = 2000;

// The map filters its already-fetched pin list client-side (Session 9.5) --
// there's no server round-trip per filter change, unlike the feed's
// get_hostel_feed() RPC. This function is the client-side mirror of that
// RPC's WHERE clause, kept in one place so the two surfaces can never
// silently disagree about what "Near Campus" or "Under GHS 2,000" means.
export function hostelMatchesFilters(hostel: FilterableHostel, filters: HostelFilters): boolean {
  if (filters.nearCampus && !hostel.tags.includes("near_campus")) return false;
  if (filters.underBudget && !(hostel.priceMin != null && hostel.priceMin < UNDER_BUDGET_THRESHOLD)) return false;
  if (filters.availableNow && hostel.availability !== "available") return false;
  if (filters.featuredOnly && !hostel.isActivelyFeatured) return false;
  if (filters.enSuite && !(hostel.facilities.includes("en_suite") || hostel.tags.includes("en_suite"))) return false;
  return true;
}
