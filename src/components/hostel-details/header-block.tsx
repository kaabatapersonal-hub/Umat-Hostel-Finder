import { MapPin, Clock, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";

export interface HeaderBlockProps {
  name: string;
  price: number;
  location: string;
  distanceText: string | null;
  roomType: string | null;
  ratingAvg: number;
  ratingCount: number;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  single: "Single room",
  double: "Double room",
  triple: "Triple room",
  quad: "Quad room",
};

export function HeaderBlock({
  name,
  price,
  location,
  distanceText,
  roomType,
  ratingAvg,
  ratingCount,
}: HeaderBlockProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-display text-ink-900">{name}</h1>
        <PriceTag amount={price} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-body-sm text-ink-500">
        <span className="flex items-center gap-1">
          <MapPin className="size-4 shrink-0" />
          {location}
        </span>
        {distanceText && (
          <span className="flex items-center gap-1">
            <Clock className="size-4 shrink-0" />
            {distanceText}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {roomType && <Badge variant="neutral">{ROOM_TYPE_LABELS[roomType] ?? roomType}</Badge>}

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
    </div>
  );
}
