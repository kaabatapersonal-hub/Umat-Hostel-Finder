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
  type LucideIcon,
} from "lucide-react";

const FACILITY_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
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

function formatFacilityLabel(facility: string): string {
  return facility
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface FacilitiesGridProps {
  facilities: string[];
}

export function FacilitiesGrid({ facilities }: FacilitiesGridProps) {
  if (facilities.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-h1 text-ink-900">Facilities</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {facilities.map((facility) => {
          const config = FACILITY_CONFIG[facility];
          const Icon = config?.icon ?? Zap;
          const label = config?.label ?? formatFacilityLabel(facility);

          return (
            <div
              key={facility}
              className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5"
            >
              <Icon className="size-4 shrink-0 text-brand-800" strokeWidth={1.75} />
              <span className="text-body-sm text-ink-900">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
