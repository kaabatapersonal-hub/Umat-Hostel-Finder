import Link from "next/link";
import { MapPin, Clock, Star, Navigation2, Map as MapIcon } from "lucide-react";
import { PriceTag } from "@/components/ui/price-tag";
import { formatWalkTime, buildDirectionsLink } from "@/lib/geo";

export interface HeaderBlockProps {
  hostelId: string;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  location: string;
  distanceText: string | null;
  distanceToCampusKm: number | null;
  latitude: number | null;
  longitude: number | null;
  ratingAvg: number;
  ratingCount: number;
}

export function HeaderBlock({
  hostelId,
  name,
  priceMin,
  priceMax,
  location,
  distanceText,
  distanceToCampusKm,
  latitude,
  longitude,
  ratingAvg,
  ratingCount,
}: HeaderBlockProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-display text-ink-900">{name}</h1>
        {priceMin != null && <PriceTag amount={priceMin} max={priceMax ?? undefined} />}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-body-sm text-ink-500">
        <span className="flex items-center gap-1">
          <MapPin className="size-4 shrink-0" />
          {location}
        </span>
        {/* The computed distance (Session 9.5) is honest and consistent
            everywhere; a manager's freeform distance_text is only shown
            when there's no real coordinate to compute from. */}
        {distanceToCampusKm != null ? (
          <span className="flex items-center gap-1">
            <Clock className="size-4 shrink-0" />
            {formatWalkTime(distanceToCampusKm)} to campus
          </span>
        ) : (
          distanceText && (
            <span className="flex items-center gap-1">
              <Clock className="size-4 shrink-0" />
              {distanceText}
            </span>
          )
        )}
      </div>

      {distanceToCampusKm != null && distanceText && (
        <span className="text-caption text-ink-300">Manager says: {distanceText}</span>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {ratingCount > 0 ? (
          <a href="#reviews" className="flex items-center gap-1 text-body-sm text-ink-900">
            <Star className="size-4 fill-gold-500 text-gold-500" />
            <span className="font-medium">{ratingAvg.toFixed(1)}</span>
            <span className="text-ink-500">({ratingCount})</span>
          </a>
        ) : (
          <span className="text-body-sm text-ink-500">New — no reviews yet</span>
        )}
      </div>

      {latitude != null && longitude != null && (
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={buildDirectionsLink({ lat: latitude, lng: longitude })}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-body-sm font-medium text-brand-800"
          >
            <Navigation2 className="size-3.5" />
            Directions
          </a>
          <Link
            href={`/map?hostelId=${hostelId}`}
            className="flex items-center gap-1 text-body-sm font-medium text-brand-800"
          >
            <MapIcon className="size-3.5" />
            View on map
          </Link>
        </div>
      )}
    </div>
  );
}
