"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { HostelDetails } from "@/lib/queries/hostels";

type RoomType = "single" | "double" | "triple" | "quad";

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  quad: "Quad",
};

const ROOM_TYPE_ORDER: RoomType[] = ["single", "double", "triple", "quad"];

export interface RoomTypeGalleryProps {
  roomImages: HostelDetails["roomImages"];
}

export function RoomTypeGallery({ roomImages }: RoomTypeGalleryProps) {
  const availableTypes = ROOM_TYPE_ORDER.filter((type) => (roomImages[type]?.length ?? 0) > 0);
  const [activeType, setActiveType] = useState<RoomType | null>(availableTypes[0] ?? null);

  if (availableTypes.length === 0) return null;

  const currentType = activeType && availableTypes.includes(activeType) ? activeType : availableTypes[0];
  const images = roomImages[currentType] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-h1 text-ink-900">Room types</h2>

      <div className="flex gap-2">
        {availableTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveType(type)}
            className={cn(
              "rounded-pill px-3.5 py-1.5 text-body-sm font-medium transition-colors",
              currentType === type ? "bg-brand-800 text-white" : "bg-surface-muted text-ink-500"
            )}
          >
            {ROOM_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentType}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        >
          {images.map((src, i) => (
            <div key={src + i} className="relative aspect-square overflow-hidden rounded-md bg-brand-50">
              <Image
                src={src}
                alt={`${ROOM_TYPE_LABELS[currentType]} room photo ${i + 1}`}
                fill
                sizes="(min-width: 640px) 33vw, 50vw"
                className="object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
