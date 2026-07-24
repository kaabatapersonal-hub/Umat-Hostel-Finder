import Link from "next/link";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriceTag, PricePendingPill } from "@/components/ui/price-tag";
import { SmartImage } from "@/components/ui/smart-image";
import { thumbnailSrc } from "@/lib/images";
import type { HostelCard as HostelCardData } from "@/lib/queries/hostels";

const AVAILABILITY_LABEL: Record<string, string> = {
  available: "Available",
  filling: "Filling Up",
  full: "Full",
};

export interface CompactHostelRowProps {
  hostel: HostelCardData;
}

// The YouTube "watch page sidebar" card shape, built from our own pieces
// (SmartImage, PriceTag, Badge) -- small thumbnail left, name/price/
// location/availability right. Used only in the desktop details sidebar;
// the mobile related-feed reuses the full HostelCard instead.
export function CompactHostelRow({ hostel }: CompactHostelRowProps) {
  const thumbnail = hostel.images[0];
  const availabilityLabel = AVAILABILITY_LABEL[hostel.availability] ?? AVAILABILITY_LABEL.available;

  return (
    <Link href={`/hostel/${hostel.id}`} className="flex gap-3 rounded-md p-1.5 hover:bg-surface-muted">
      <SmartImage
        src={thumbnailSrc(thumbnail)}
        blurDataURL={thumbnail?.blurDataURL}
        alt={hostel.name}
        sizeHint="thumbnail"
        className="aspect-video w-32 shrink-0 rounded-md"
      />
      <div className="flex min-w-0 flex-col gap-1 py-0.5">
        <h3 className="line-clamp-2 text-body-strong font-semibold leading-snug text-ink-900">{hostel.name}</h3>
        <span className="flex items-center gap-1 text-caption text-ink-500">
          <MapPin className="size-3 shrink-0" />
          <span className="line-clamp-1">{hostel.location}</span>
        </span>
        <div className="mt-0.5 flex items-center gap-1.5">
          {hostel.priceMin != null ? (
            <PriceTag
              amount={hostel.priceMin}
              max={hostel.priceMax ?? undefined}
              pricePrefix={hostel.priceMin === hostel.priceMax ? "From" : null}
              className="text-caption"
            />
          ) : (
            <PricePendingPill label="Prices being confirmed" className="text-caption" />
          )}
          <Badge
            variant={hostel.availability === "available" ? "available" : hostel.availability === "full" ? "full" : "filling"}
            size="sm"
          >
            {availabilityLabel}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
