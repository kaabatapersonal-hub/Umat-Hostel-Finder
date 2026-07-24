import { roomTypeLabel, type RoomTypeEntry } from "@/lib/room-types";
import type { UploadedImage } from "@/lib/images";
import type { EditableHostelFields } from "@/lib/hostel-fields";

export interface DiffEntry {
  label: string;
  oldValue: string;
  newValue: string;
}

function formatList(values: string[] | undefined): string {
  if (!values || values.length === 0) return "(none)";
  return values.join(", ");
}

function formatRoomTypes(entries: RoomTypeEntry[] | undefined): string {
  if (!entries || entries.length === 0) return "(none)";
  return entries
    .map((entry) => `${roomTypeLabel(entry.type)}: ${entry.price != null ? `GHS ${entry.price.toLocaleString()}` : "price unconfirmed"}`)
    .join("; ");
}

function formatImages(images: UploadedImage[] | undefined): string {
  const count = images?.length ?? 0;
  return `${count} photo${count === 1 ? "" : "s"}`;
}

function formatPlain(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "(none)";
  return String(value);
}

// Only the fields the owner actually proposed changing appear here (a key
// missing from `pending` means "not part of this request," so it's simply
// skipped) -- and only if the proposed value actually differs from what's
// live today. "Even a simple changed-fields list is enough" per the
// brief; this isn't trying to be a rich visual diff.
export function buildEditRequestDiff(live: EditableHostelFields, pending: Partial<EditableHostelFields>): DiffEntry[] {
  const entries: DiffEntry[] = [];

  function compare(label: string, oldVal: unknown, newVal: unknown, format: (v: never) => string) {
    if (newVal === undefined) return;
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return;
    entries.push({ label, oldValue: format(oldVal as never), newValue: format(newVal as never) });
  }

  compare("Name", live.name, pending.name, formatPlain as (v: never) => string);
  compare("Location", live.location, pending.location, formatPlain as (v: never) => string);
  compare("Distance from campus", live.distanceText, pending.distanceText, formatPlain as (v: never) => string);
  compare("Description", live.description, pending.description, formatPlain as (v: never) => string);
  compare("WhatsApp number", live.contact, pending.contact, formatPlain as (v: never) => string);
  compare("Call number", live.callNumber, pending.callNumber, formatPlain as (v: never) => string);
  compare("Latitude", live.latitude, pending.latitude, formatPlain as (v: never) => string);
  compare("Longitude", live.longitude, pending.longitude, formatPlain as (v: never) => string);
  compare("Facilities", live.facilities, pending.facilities, formatList as (v: never) => string);
  compare("Tags", live.tags, pending.tags, formatList as (v: never) => string);
  compare("Room types & prices", live.roomTypes, pending.roomTypes, formatRoomTypes as (v: never) => string);
  compare("Photos", live.images, pending.images, formatImages as (v: never) => string);

  return entries;
}
