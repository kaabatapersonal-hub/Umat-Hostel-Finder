import {
  Wifi,
  Droplet,
  Shield,
  CookingPot,
  Zap,
  CarFront,
  WashingMachine,
  Fuel,
  Bath,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

interface FacilityConfig {
  label: string;
  icon: LucideIcon;
}

const FACILITY_CONFIG: Record<string, FacilityConfig> = {
  wifi: { label: "WiFi", icon: Wifi },
  water: { label: "Water", icon: Droplet },
  security: { label: "Security", icon: Shield },
  kitchen: { label: "Kitchen", icon: CookingPot },
  electricity: { label: "Electricity", icon: Zap },
  parking: { label: "Parking", icon: CarFront },
  laundry: { label: "Laundry", icon: WashingMachine },
  generator: { label: "Generator", icon: Fuel },
  en_suite: { label: "En-suite", icon: Bath },
};

// The 8 quick-pick presets for the submit/add form (Session 8). en_suite is
// a recognized facility (has its own icon/label below) but isn't one of the
// common presets.
export const COMMON_FACILITIES = [
  "wifi",
  "water",
  "security",
  "kitchen",
  "electricity",
  "parking",
  "laundry",
  "generator",
] as const;

// Managers can add facilities beyond the presets (e.g. "Prepaid meter",
// "Study room") — anything not in FACILITY_CONFIG still renders, just with
// a generic fallback icon and a title-cased label, never broken.
const FALLBACK_ICON: LucideIcon = CheckCircle2;

export function facilityLabel(facility: string): string {
  const known = FACILITY_CONFIG[facility];
  if (known) return known.label;
  return facility
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function facilityIcon(facility: string): LucideIcon {
  return FACILITY_CONFIG[facility]?.icon ?? FALLBACK_ICON;
}
