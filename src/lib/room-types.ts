import { parseUploadedImages, type UploadedImage } from "./images";

// The hero gallery should show every photo associated with the hostel, not
// just the general gallery -- a hostel with no general photos but real
// room-type photos shouldn't show the "no photos yet" placeholder while
// those photos sit unseen in their own room-type section. General images
// come first (they're the ones the manager chose to lead with), then each
// room type's photos in occupancy order, deduped by URL since the same
// photo occasionally gets attached in both places.
export function mergeGalleryImages(images: UploadedImage[], roomTypes: RoomTypeEntry[]): UploadedImage[] {
  const seen = new Set<string>();
  const merged: UploadedImage[] = [];
  for (const image of [...images, ...roomTypes.flatMap((roomType) => roomType.images)]) {
    if (seen.has(image.url)) continue;
    seen.add(image.url);
    merged.push(image);
  }
  return merged;
}

// UMaT's own room-type vocabulary. Stored as plain string keys (not a
// Postgres enum) so the set stays easy to extend — see
// supabase/migrations/20260702221215_room_types_pricing_facilities_contact.sql.
export type RoomTypeKey = "1_in_room" | "2_in_room" | "3_in_room" | "4_in_room" | "6_in_room";

export interface RoomTypeEntry {
  type: RoomTypeKey;
  // Optional free-text variant tag ("New Block", "No Balcony", ...) --
  // the same base `type` can appear more than once on a hostel as long
  // as the label differs (real hostels price the same occupancy
  // differently by block/floor/finish). null/empty means "the plain
  // variant" -- at most one of those is allowed per type, same as
  // before this existed.
  label: string | null;
  // null when this room type's price hasn't been confirmed yet -- the
  // Submit form always requires a price for a room type it creates, but
  // partial data seeded directly (bulk import, a quick admin SQL insert
  // ahead of launch) can legitimately have a room type with no price yet.
  // Display layers show "Confirm with manager" rather than dropping the
  // row (see room-type-breakdown.tsx) or a broken "GHS null".
  price: number | null;
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

// "2 in a room · New Block", or plain "2 in a room" when there's no
// label -- the one place this composition happens, so every display
// surface (feed, details, admin diff) reads it the same way.
export function roomTypeVariantLabel(type: string, label: string | null): string {
  const base = roomTypeLabel(type);
  return label ? `${base} · ${label}` : base;
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
      if (type === null) return null;
      const price = "price" in entry && typeof entry.price === "number" ? entry.price : null;
      const label = "label" in entry && typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : null;

      return {
        type: type as RoomTypeKey,
        label,
        price,
        images: parseUploadedImages("images" in entry ? entry.images : []),
      };
    })
    .filter((entry): entry is RoomTypeEntry => entry !== null);

  return sortRoomTypes(entries);
}
