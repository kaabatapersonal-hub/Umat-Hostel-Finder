import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, isStale } from "@/lib/utils";

export interface AvailabilityBlockProps {
  availability: string;
  availabilityUpdatedAt: string;
}

const AVAILABILITY_CONFIG: Record<string, { label: string; variant: "available" | "filling" | "full" }> = {
  available: { label: "Available", variant: "available" },
  filling: { label: "Filling Up", variant: "filling" },
  full: { label: "Full", variant: "full" },
};

export function AvailabilityBlock({ availability, availabilityUpdatedAt }: AvailabilityBlockProps) {
  const config = AVAILABILITY_CONFIG[availability] ?? AVAILABILITY_CONFIG.available;
  const stale = isStale(availabilityUpdatedAt);

  return (
    <div className="flex flex-col gap-1.5">
      <Badge variant={config.variant} size="md" className="w-fit">
        {config.label}
      </Badge>
      <div className="flex items-center gap-1.5 text-caption text-ink-500">
        <span>Updated {formatRelativeTime(availabilityUpdatedAt)}</span>
        {stale && (
          <span className="flex items-center gap-1 text-warning">
            <Info className="size-3.5" />
            May be outdated
          </span>
        )}
      </div>
    </div>
  );
}
