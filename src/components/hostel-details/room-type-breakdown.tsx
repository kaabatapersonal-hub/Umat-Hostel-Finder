"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { PriceTag } from "@/components/ui/price-tag";
import { SmartImage } from "@/components/ui/smart-image";
import { roomTypeLabel, sortRoomTypes, type RoomTypeEntry } from "@/lib/room-types";

// Code-split, same reasoning as the hero gallery's lightbox import -- only
// paid for once someone actually taps a room photo.
const PhotoLightbox = dynamic(() => import("./photo-lightbox").then((m) => m.PhotoLightbox), { ssr: false });

export interface RoomTypeBreakdownProps {
  roomTypes: RoomTypeEntry[];
}

// Merges what used to be two separate ideas (a tabbed photo gallery and a
// single header price) into one list: every room type the hostel offers,
// each with its own price and — when available — its own photos. Photos
// are optional per type (Session 5 fills the pipeline in); a type with no
// photos yet still shows its price.
export function RoomTypeBreakdown({ roomTypes }: RoomTypeBreakdownProps) {
  // Which room type's gallery is open in the lightbox, and at what photo --
  // one shared viewer instance reused across every room type's grid rather
  // than one per row.
  const [active, setActive] = useState<{ type: string; index: number } | null>(null);

  if (roomTypes.length === 0) return null;

  const sorted = sortRoomTypes(roomTypes);
  const activeRoomType = active ? sorted.find((r) => r.type === active.type) : undefined;

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
                {roomType.images.map((image, i) => (
                  <button
                    key={image.url + i}
                    type="button"
                    aria-label={`View ${roomTypeLabel(roomType.type)} photo ${i + 1} fullscreen`}
                    onClick={() => setActive({ type: roomType.type, index: i })}
                    className="appearance-none p-0"
                  >
                    <SmartImage
                      src={image.url}
                      blurDataURL={image.blurDataURL}
                      alt={`${roomTypeLabel(roomType.type)} photo ${i + 1}`}
                      sizeHint="medium"
                      className="aspect-square rounded-md"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {activeRoomType && (
        <PhotoLightbox
          images={activeRoomType.images}
          alt={roomTypeLabel(activeRoomType.type)}
          open={active !== null}
          startIndex={active?.index ?? 0}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
