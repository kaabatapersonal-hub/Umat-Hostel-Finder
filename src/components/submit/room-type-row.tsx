"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ImageUploader } from "@/components/ui/image-uploader";
import { ROOM_TYPE_LABELS, type RoomTypeKey } from "@/lib/room-types";
import type { UploadedImage } from "@/lib/images";

export interface RoomTypeDraft {
  key: string;
  type: RoomTypeKey;
  price: string;
  images: UploadedImage[];
}

export interface RoomTypeRowProps {
  draft: RoomTypeDraft;
  availableTypes: RoomTypeKey[];
  canRemove: boolean;
  errors?: { type?: string; price?: string };
  onChange: (next: RoomTypeDraft) => void;
  onRemove: () => void;
}

export function RoomTypeRow({ draft, availableTypes, canRemove, errors, onChange, onRemove }: RoomTypeRowProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 flex-wrap gap-1.5" role="radiogroup" aria-label="Room type">
          {availableTypes.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={draft.type === type}
              onClick={() => onChange({ ...draft, type })}
              className={cn(
                "rounded-pill border px-3 py-1.5 text-body-sm font-medium transition-colors",
                draft.type === type
                  ? "border-brand-800 bg-brand-800 text-white"
                  : "border-line bg-surface text-ink-500"
              )}
            >
              {ROOM_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {canRemove && (
          <button
            type="button"
            aria-label="Remove room type"
            onClick={onRemove}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {errors?.type && <p className="text-body-sm text-danger">{errors.type}</p>}

      <Input
        label="Price (GHS / year)"
        type="number"
        inputMode="decimal"
        min={0}
        placeholder="e.g. 2500"
        value={draft.price}
        onChange={(e) => onChange({ ...draft, price: e.target.value })}
        error={errors?.price}
      />

      <ImageUploader
        bucket="room-images"
        label="Photos for this room type (optional)"
        value={draft.images}
        onChange={(images) => onChange({ ...draft, images })}
        maxFiles={4}
      />
    </div>
  );
}
