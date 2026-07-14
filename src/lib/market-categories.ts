import type { LucideIcon } from "lucide-react";
import { Sofa, GraduationCap, Laptop, Shirt, CookingPot, Bike, Gamepad2, Wrench, Package } from "lucide-react";
import type { MarketCategory, MarketCondition } from "@/lib/supabase/database.types";

// Categories are a fixed, closed set (a CHECK constraint, not free text like
// hostel facilities) -- no fallback-icon/custom-entry half needed the way
// facilities.ts has, just a direct lookup over all nine.
interface CategoryConfig {
  label: string;
  icon: LucideIcon;
}

export const MARKET_CATEGORY_CONFIG: Record<MarketCategory, CategoryConfig> = {
  hostel_essentials: { label: "Hostel Essentials", icon: Sofa },
  academics: { label: "Academics", icon: GraduationCap },
  electronics: { label: "Electronics", icon: Laptop },
  fashion: { label: "Fashion", icon: Shirt },
  kitchen: { label: "Kitchen", icon: CookingPot },
  transport: { label: "Transport", icon: Bike },
  gaming: { label: "Gaming", icon: Gamepad2 },
  services: { label: "Services", icon: Wrench },
  other: { label: "Other", icon: Package },
};

export const MARKET_CATEGORY_ORDER: MarketCategory[] = [
  "hostel_essentials",
  "academics",
  "electronics",
  "fashion",
  "kitchen",
  "transport",
  "gaming",
  "services",
  "other",
];

export function categoryLabel(category: string): string {
  return MARKET_CATEGORY_CONFIG[category as MarketCategory]?.label ?? category;
}

export function categoryIcon(category: string): LucideIcon {
  return MARKET_CATEGORY_CONFIG[category as MarketCategory]?.icon ?? Package;
}

const MARKET_CONDITION_LABELS: Record<MarketCondition, string> = {
  new: "New",
  like_new: "Like New",
  good: "Used - Good",
  fair: "Used - Fair",
};

export const MARKET_CONDITION_ORDER: MarketCondition[] = ["new", "like_new", "good", "fair"];

export function conditionLabel(condition: string | null): string | null {
  if (!condition) return null;
  return MARKET_CONDITION_LABELS[condition as MarketCondition] ?? condition;
}
