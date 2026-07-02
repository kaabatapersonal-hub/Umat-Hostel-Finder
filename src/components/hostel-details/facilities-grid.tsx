import { facilityIcon, facilityLabel } from "@/lib/facilities";

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
          const Icon = facilityIcon(facility);

          return (
            <div
              key={facility}
              className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5"
            >
              <Icon className="size-4 shrink-0 text-brand-800" strokeWidth={1.75} />
              <span className="text-body-sm text-ink-900">{facilityLabel(facility)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
