"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";
import { RoomTypeRow, type RoomTypeDraft } from "./room-type-row";
import { ROOM_TYPE_ORDER, type RoomTypeKey } from "@/lib/room-types";

export interface RoomTypeEditorProps {
  value: RoomTypeDraft[];
  onChange: (next: RoomTypeDraft[]) => void;
  errors?: Record<number, { type?: string; price?: string }>;
  formError?: string;
}

function newDraft(type: RoomTypeKey): RoomTypeDraft {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, label: "", price: "", images: [] };
}

export function RoomTypeEditor({ value, onChange, errors, formError }: RoomTypeEditorProps) {
  // The same base type can now appear more than once (with different
  // labels -- "2 in a room · New Block" vs "2 in a room · Old Block"), so
  // every type stays pickable in every row; submitHostelSchema's
  // superRefine is what actually catches a true duplicate (same type +
  // same/blank label) at submit time.
  const usedTypes = value.map((v) => v.type);
  const unusedTypes = ROOM_TYPE_ORDER.filter((t) => !usedTypes.includes(t));

  const validPrices = value.map((v) => parseFloat(v.price)).filter((n) => Number.isFinite(n) && n > 0);
  const min = validPrices.length > 0 ? Math.min(...validPrices) : null;
  const max = validPrices.length > 0 ? Math.max(...validPrices) : null;

  function addRoomType() {
    // Default a fresh row to a type not already used, purely as a
    // friendlier starting point (no immediate "already used" error) --
    // once every type has been used at least once, default back to the
    // first type; the user can freely change it and add a label.
    onChange([...value, newDraft(unusedTypes[0] ?? ROOM_TYPE_ORDER[0])]);
  }

  function updateRow(index: number, next: RoomTypeDraft) {
    onChange(value.map((v, i) => (i === index ? next : v)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((draft, index) => (
        <RoomTypeRow
          key={draft.key}
          draft={draft}
          availableTypes={ROOM_TYPE_ORDER}
          canRemove={value.length > 1}
          errors={errors?.[index]}
          onChange={(next) => updateRow(index, next)}
          onRemove={() => removeRow(index)}
        />
      ))}

      {formError && <p className="text-body-sm text-danger">{formError}</p>}

      <Button type="button" variant="secondary" onClick={addRoomType} className="self-start">
        <Plus className="size-4" />
        Add room type
      </Button>

      {min !== null && (
        <div className="flex items-center gap-2 rounded-md bg-surface-muted px-3.5 py-2.5">
          <span className="text-body-sm text-ink-500">Students will see:</span>
          <PriceTag amount={min} max={max ?? undefined} />
        </div>
      )}
    </div>
  );
}
