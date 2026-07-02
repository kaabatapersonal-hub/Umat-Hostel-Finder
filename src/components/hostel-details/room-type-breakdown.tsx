import Image from "next/image";
import { PriceTag } from "@/components/ui/price-tag";
import { roomTypeLabel, sortRoomTypes, type RoomTypeEntry } from "@/lib/room-types";

export interface RoomTypeBreakdownProps {
  roomTypes: RoomTypeEntry[];
}

// Merges what used to be two separate ideas (a tabbed photo gallery and a
// single header price) into one list: every room type the hostel offers,
// each with its own price and — when available — its own photos. Photos
// are optional per type (Session 5 fills the pipeline in); a type with no
// photos yet still shows its price.
export function RoomTypeBreakdown({ roomTypes }: RoomTypeBreakdownProps) {
  if (roomTypes.length === 0) return null;

  const sorted = sortRoomTypes(roomTypes);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-h1 text-ink-900">Room types</h2>
      <div className="flex flex-col gap-4">
        {sorted.map((roomType) => (
          <div key={roomType.type} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-body-strong text-ink-900">{roomTypeLabel(roomType.type)}</span>
              <PriceTag amount={roomType.price} />
            </div>

            {roomType.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {roomType.images.map((src, i) => (
                  <div key={src + i} className="relative aspect-square overflow-hidden rounded-md bg-brand-50">
                    <Image
                      src={src}
                      alt={`${roomTypeLabel(roomType.type)} photo ${i + 1}`}
                      fill
                      sizes="33vw"
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
