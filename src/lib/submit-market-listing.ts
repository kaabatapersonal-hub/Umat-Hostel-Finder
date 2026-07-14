import { z } from "zod";
import { isValidPhoneNumber } from "@/lib/contact";
import { MARKET_CATEGORY_ORDER, SERVICE_TYPE_ORDER } from "@/lib/market-categories";
import type { MarketCategory, MarketServiceType } from "@/lib/supabase/database.types";

const uploadedImageSchema = z.object({
  url: z.string(),
  thumbUrl: z.string().nullable(),
  blurDataURL: z.string().nullable(),
});

// Mirrors ImageUploader's maxFiles for this form -- see submit-hostel.ts's
// identical comment for why this cap lives here, not just in the UI.
const MAX_LISTING_IMAGES = 5;
const CONDITION_VALUES = ["new", "like_new", "good", "fair"] as const;

export const submitMarketListingSchema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(120, "Keep it under 120 characters"),
    description: z.string().trim().max(1000, "Keep it under 1000 characters").nullable(),
    price: z.coerce.number({ error: "Enter a price" }).min(0, "Price can't be negative"),
    category: z.enum(MARKET_CATEGORY_ORDER as [MarketCategory, ...MarketCategory[]]),
    condition: z.enum(CONDITION_VALUES).nullable(),
    serviceType: z.enum(SERVICE_TYPE_ORDER as [MarketServiceType, ...MarketServiceType[]]).nullable(),
    // At least one photo required -- a marketplace listing with no photo
    // is dead on arrival regardless of what the DB itself would allow.
    images: z
      .array(uploadedImageSchema)
      .min(1, "Add at least one photo")
      .max(MAX_LISTING_IMAGES, `Up to ${MAX_LISTING_IMAGES} photos`),
    contact: z
      .string()
      .trim()
      .min(1, "WhatsApp number is required")
      .refine(isValidPhoneNumber, "Enter a valid phone number, e.g. 024 000 0000"),
    hostelId: z.string().uuid().nullable(),
  })
  // Condition is meaningless for a service (there's no physical item to
  // grade) -- required for everything else, hidden entirely in the UI
  // when category is "services".
  .refine((data) => data.category === "services" || !!data.condition, {
    message: "Select a condition",
    path: ["condition"],
  });

export type SubmitMarketListingFormValues = z.infer<typeof submitMarketListingSchema>;
