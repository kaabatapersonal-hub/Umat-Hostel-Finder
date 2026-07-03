import type { RoomTypeEntry } from "@/lib/room-types";
import type { UploadedImage } from "@/lib/images";

// The field set a submission and a hostel's live/pending-edit data share —
// everything the Submit form collects, independent of which table or
// column it eventually lands in. Session 8.5 reuses this across creating a
// submission, editing a pending submission, and an owner's pending-edit
// request on an approved hostel.
export interface EditableHostelFields {
  name: string;
  location: string;
  distanceText: string | null;
  description: string | null;
  roomTypes: RoomTypeEntry[];
  images: UploadedImage[];
  facilities: string[];
  contact: string;
  callNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
}
