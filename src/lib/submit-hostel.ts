import { z } from "zod";
import { isValidPhoneNumber } from "@/lib/contact";
import { ROOM_TYPE_ORDER, type RoomTypeKey } from "@/lib/room-types";

const uploadedImageSchema = z.object({
  url: z.string(),
  blurDataURL: z.string().nullable(),
});

const roomTypeFormSchema = z.object({
  type: z.enum(ROOM_TYPE_ORDER as [RoomTypeKey, ...RoomTypeKey[]]),
  price: z.coerce.number({ error: "Enter a price" }).positive("Price must be greater than 0"),
  images: z.array(uploadedImageSchema).default([]),
});

// The whole Submit form, validated as one shape at submit time. Room-type
// duplicate-checking lives here (superRefine) rather than in the UI so the
// database-shape rule ("one price per occupancy type") is enforced the
// same way regardless of how a future form (e.g. an edit-listing screen)
// assembles this object.
export const submitHostelSchema = z
  .object({
    name: z.string().trim().min(2, "Hostel name is required"),
    location: z.string().trim().min(2, "Location is required"),
    distanceText: z.string().trim().nullable(),
    description: z.string().trim().nullable(),
    roomTypes: z
      .array(roomTypeFormSchema)
      .min(1, "Add at least one room type")
      .superRefine((types, ctx) => {
        const seen = new Set<string>();
        types.forEach((entry, index) => {
          if (seen.has(entry.type)) {
            ctx.addIssue({
              code: "custom",
              message: "Each room type can only be added once",
              path: [index, "type"],
            });
          }
          seen.add(entry.type);
        });
      }),
    images: z.array(uploadedImageSchema).default([]),
    facilities: z.array(z.string()).default([]),
    whatsappNumber: z
      .string()
      .trim()
      .min(1, "WhatsApp number is required")
      .refine(isValidPhoneNumber, "Enter a valid phone number, e.g. 024 000 0000"),
    callNumber: z.string().trim().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    tags: z.array(z.string()).default([]),
  })
  .refine((data) => !data.callNumber || isValidPhoneNumber(data.callNumber), {
    message: "Enter a valid phone number, e.g. 024 000 0000",
    path: ["callNumber"],
  });

export type SubmitHostelFormValues = z.infer<typeof submitHostelSchema>;
