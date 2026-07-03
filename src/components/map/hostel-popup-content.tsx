import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SmartImage } from "@/components/ui/smart-image";
import { PriceTag } from "@/components/ui/price-tag";
import { Badge } from "@/components/ui/badge";
import type { MapHostelPin } from "@/lib/queries/map-hostels";

const AVAILABILITY_CONFIG: Record<string, { label: string; variant: "available" | "filling" | "full" }> = {
  available: { label: "Available", variant: "available" },
  filling: { label: "Filling Up", variant: "filling" },
  full: { label: "Full", variant: "full" },
};

export interface HostelPopupContentProps {
  hostel: MapHostelPin;
}

// Deliberately small and tappable -- this is a Leaflet popup on a phone
// screen, not a card in the feed. One tap opens it, "View details" is the
// obvious next tap.
export function HostelPopupContent({ hostel }: HostelPopupContentProps) {
  const availability = AVAILABILITY_CONFIG[hostel.availability] ?? AVAILABILITY_CONFIG.available;

  return (
    <Link href={`/hostel/${hostel.id}`} className="flex w-44 flex-col gap-2">
      <SmartImage
        src={hostel.thumbnail?.url ?? null}
        blurDataURL={hostel.thumbnail?.blurDataURL}
        alt={hostel.name}
        sizeHint="thumbnail"
        className="aspect-video w-full rounded-md"
      />

      <div className="flex flex-col gap-1">
        <span className="line-clamp-1 text-body-strong text-ink-900">{hostel.name}</span>

        <div className="flex items-center justify-between gap-1.5">
          <Badge variant={availability.variant} size="sm">
            {availability.label}
          </Badge>
          {hostel.isActivelyFeatured && (
            <Badge variant="featured" size="sm">
              Featured
            </Badge>
          )}
        </div>

        {hostel.priceMin != null && (
          <PriceTag amount={hostel.priceMin} max={hostel.priceMax ?? undefined} className="w-fit" />
        )}

        <span className="mt-0.5 flex items-center gap-1 text-caption font-medium text-brand-800">
          View details
          <ArrowRight className="size-3" />
        </span>
      </div>
    </Link>
  );
}
