import Link from "next/link";
import { Footprints, Navigation2 } from "lucide-react";
import { SmartImage } from "@/components/ui/smart-image";
import { PriceTag, PricePendingPill } from "@/components/ui/price-tag";
import { Badge } from "@/components/ui/badge";
import { formatWalkTime, buildDirectionsLink, haversineDistanceKm, type LatLng } from "@/lib/geo";
import { thumbnailSrc } from "@/lib/images";
import type { MapHostelPin } from "@/lib/queries/map-hostels";

const AVAILABILITY_CONFIG: Record<string, { label: string; variant: "available" | "filling" | "full" }> = {
  available: { label: "Available", variant: "available" },
  filling: { label: "Filling Up", variant: "filling" },
  full: { label: "Full", variant: "full" },
};

export interface HostelPopupContentProps {
  hostel: MapHostelPin;
  // Once the user has located themselves (or dropped a custom "near here"
  // point), the popup also shows distance from that point -- omitted
  // entirely rather than showing a dash/placeholder when unavailable.
  userPosition?: LatLng | null;
  customPoint?: LatLng | null;
}

// Deliberately small and tappable -- this is a Leaflet popup on a phone
// screen, not a card in the feed. One tap opens it, "View details" or
// "Directions" is the obvious next tap. Two separate links (never a link
// nested inside a link) since Directions hands off to Google Maps in a new
// tab while View details stays in-app.
export function HostelPopupContent({ hostel, userPosition, customPoint }: HostelPopupContentProps) {
  const availability = AVAILABILITY_CONFIG[hostel.availability] ?? AVAILABILITY_CONFIG.available;
  const destination: LatLng = { lat: hostel.latitude, lng: hostel.longitude };

  const distanceFromUserKm = userPosition ? haversineDistanceKm(userPosition, destination) : null;
  const distanceFromCustomKm = customPoint ? haversineDistanceKm(customPoint, destination) : null;

  return (
    <div className="flex w-56 flex-col gap-2">
      <Link href={`/hostel/${hostel.id}`} className="flex flex-col gap-2">
        <SmartImage
          src={thumbnailSrc(hostel.thumbnail)}
          blurDataURL={hostel.thumbnail?.blurDataURL}
          alt={hostel.name}
          sizeHint="thumbnail"
          className="aspect-video w-full rounded-md"
        />

        <div className="flex flex-col gap-1">
          <span className="line-clamp-1 text-body-strong text-ink-900">{hostel.name}</span>

          <div className="flex items-center gap-1.5">
            <Badge variant={availability.variant} size="sm">
              {availability.label}
            </Badge>
            {hostel.isActivelyFeatured && (
              <Badge variant="featured" size="sm">
                Featured
              </Badge>
            )}
          </div>

          {hostel.priceMin != null ? (
            <PriceTag
              amount={hostel.priceMin}
              max={hostel.priceMax ?? undefined}
              pricePrefix={hostel.priceMin === hostel.priceMax ? "From" : null}
              className="w-fit"
            />
          ) : (
            <PricePendingPill label="Prices being confirmed" className="w-fit" />
          )}
        </div>
      </Link>

      <div className="flex flex-col gap-0.5 text-caption text-ink-500">
        <span className="flex items-center gap-1">
          <Footprints className="size-3 shrink-0" />
          {formatWalkTime(hostel.distanceToCampusKm)} to campus
        </span>
        {distanceFromUserKm != null && (
          <span className="flex items-center gap-1">
            <Footprints className="size-3 shrink-0" />
            {formatWalkTime(distanceFromUserKm)} from you
          </span>
        )}
        {distanceFromCustomKm != null && (
          <span className="flex items-center gap-1">
            <Footprints className="size-3 shrink-0" />
            {formatWalkTime(distanceFromCustomKm)} from dropped pin
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <Link
          href={`/hostel/${hostel.id}`}
          className="flex-1 rounded-md bg-brand-800 px-2 py-1.5 text-center text-caption font-medium text-white"
        >
          View details
        </Link>
        <a
          href={buildDirectionsLink(destination, userPosition ?? undefined)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get directions"
          className="flex items-center justify-center rounded-md border border-line px-2 py-1.5 text-brand-800"
        >
          <Navigation2 className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
