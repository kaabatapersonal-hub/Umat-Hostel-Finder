import { parseUploadedImages, type UploadedImage } from "./images";

// UMaT's own room-type vocabulary. Stored as plain string keys (not a
// Postgres enum) so the set stays easy to extend — see
// supabase/migrations/20260702221215_room_types_pricing_facilities_contact.sql.
export type RoomTypeKey = "1_in_room" | "2_in_room" | "3_in_room" | "4_in_room" | "6_in_room";

export interface RoomTypeEntry {
  type: RoomTypeKey;
  price: number;
  images: UploadedImage[];
}

export const ROOM_TYPE_LABELS: Record<RoomTypeKey, string> = {
  "1_in_room": "1 in a room",
  "2_in_room": "2 in a room",
  "3_in_room": "3 in a room",
  "4_in_room": "4 in a room",
  "6_in_room": "6 in a room",
};

// Occupancy order — smallest room first reads most naturally.
export const ROOM_TYPE_ORDER: RoomTypeKey[] = [
  "1_in_room",
  "2_in_room",
  "3_in_room",
  "4_in_room",
  "6_in_room",
];

// Use this everywhere a room type appears — details page, submit form,
// admin — never show the raw key.
export function roomTypeLabel(key: string): string {
  return ROOM_TYPE_LABELS[key as RoomTypeKey] ?? key;
}

export function sortRoomTypes<T extends { type: string }>(roomTypes: readonly T[]): T[] {
  return [...roomTypes].sort(
    (a, b) => ROOM_TYPE_ORDER.indexOf(a.type as RoomTypeKey) - ROOM_TYPE_ORDER.indexOf(b.type as RoomTypeKey)
  );
}

// Defensive parse of the room_types jsonb column, sorted by occupancy.
export function parseRoomTypes(value: unknown): RoomTypeEntry[] {
  if (!Array.isArray(value)) return [];

  const entries = value
    .map((entry): RoomTypeEntry | null => {
      if (!entry || typeof entry !== "object") return null;
      const type = "type" in entry && typeof entry.type === "string" ? entry.type : null;
      const price = "price" in entry && typeof entry.price === "number" ? entry.price : null;
      if (type === null || price === null) return null;

      return {
        type: type as RoomTypeKey,
        price,
        images: parseUploadedImages("images" in entry ? entry.images : []),
      };
    })
    .filter((entry): entry is RoomTypeEntry => entry !== null);

  return sortRoomTypes(entries);
}
