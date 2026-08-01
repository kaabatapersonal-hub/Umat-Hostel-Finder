"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MARKET_CATEGORY_CONFIG,
  MARKET_CATEGORY_ORDER,
  MARKET_CONDITION_ORDER,
  SERVICE_TYPE_ORDER,
  conditionLabel,
  serviceTypeLabel,
} from "@/lib/market-categories";
import { submitMarketListingSchema } from "@/lib/submit-market-listing";
import { useCreateMarketListing } from "@/hooks/use-create-market-listing";
import { useUpdateMarketListing } from "@/hooks/use-update-market-listing";
import { useHostelOptions } from "@/hooks/use-hostel-options";
import { useSavedHostels } from "@/hooks/use-saved-hostels";
import { cn } from "@/lib/utils";
import type { UploadedImage } from "@/lib/images";
import type { MarketCategory, MarketCondition, MarketServiceType } from "@/lib/supabase/database.types";
import type { MarketListing } from "@/lib/queries/market";

// admin-create backs /admin/market/new -- admin-assisted onboarding for
// vendors who won't self-onboard (Part 5 of the Marketplace Pre-Launch
// brief). It reuses this exact form + useCreateMarketListing unchanged:
// useCreateMarketListing always sets seller_id to whoever is actually
// signed in, so the acting admin naturally becomes the listing's owner
// until a real student claims it later -- no separate insert path needed,
// just two extra vendor fields threaded through.
export type MarketListingFormMode = { kind: "create" } | { kind: "edit"; listingId: string } | { kind: "admin-create" };

interface MarketListingFormState {
  title: string;
  description: string;
  price: string;
  isFree: boolean;
  // A flyer-style listing (several items/prices in one photo) with no
  // single real price -- mutually exclusive with isFree, see the toggle
  // pair in the JSX below.
  priceVaries: boolean;
  category: MarketCategory | null;
  condition: MarketCondition | null;
  serviceType: MarketServiceType | null;
  images: UploadedImage[];
  contact: string;
  hostelId: string | null;
  vendorName: string;
}

function blankState(): MarketListingFormState {
  return {
    title: "",
    description: "",
    price: "",
    isFree: false,
    priceVaries: false,
    category: null,
    condition: null,
    serviceType: null,
    images: [],
    contact: "",
    hostelId: null,
    vendorName: "",
  };
}

// The server-side rate limit (enforce_market_listing_rate_limit) is the
// one failure mode where the raw Postgres message ("Rate limit: too many
// listings in the last hour/24 hours") would otherwise leak straight into
// the UI verbatim -- same "friendlier copy, no retry-and-fail-again"
// posture use-create-buzz-post.ts already uses for its own rate limit.
function listingErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("Rate limit")) return "You're listing a lot! Try again in a bit.";
  return message || fallback;
}

function listingToFormState(listing: MarketListing): MarketListingFormState {
  return {
    title: listing.title,
    description: listing.description ?? "",
    price: listing.price === 0 ? "" : String(listing.price),
    isFree: listing.price === 0 && !listing.priceVaries,
    priceVaries: listing.priceVaries,
    category: listing.category,
    condition: listing.condition,
    serviceType: listing.serviceType,
    images: listing.images,
    contact: listing.contact,
    hostelId: listing.hostelId,
    vendorName: listing.vendorName ?? "",
  };
}

export function MarketListingForm({
  mode,
  initialListing,
}: {
  mode: MarketListingFormMode;
  initialListing?: MarketListing | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<MarketListingFormState>(() => (initialListing ? listingToFormState(initialListing) : blankState()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const createListing = useCreateMarketListing();
  const updateListing = useUpdateMarketListing();
  const isPending = createListing.isPending || updateListing.isPending;
  const { data: hostelOptions = [] } = useHostelOptions();
  const { data: savedHostels } = useSavedHostels();

  // Gentle auto-suggestion, not a forced prompt: if this is a brand new
  // listing and the seller has exactly one saved hostel, pre-fill the
  // dropdown with it -- still fully visible and changeable/clearable, so
  // nothing is being decided on the student's behalf. More than one saved
  // hostel is ambiguous (which one are they actually at?), so it's left
  // blank rather than guessing.
  useEffect(() => {
    if (mode.kind !== "create" || !savedHostels || savedHostels.length !== 1) return;
    setForm((prev) => (prev.hostelId ? prev : { ...prev, hostelId: savedHostels[0].hostelId }));
  }, [mode.kind, savedHostels]);

  function set<K extends keyof MarketListingFormState>(key: K, value: MarketListingFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const isServiceCategory = form.category === "services";

    const result = submitMarketListingSchema.safeParse({
      title: form.title,
      description: form.description.trim() || null,
      price: form.isFree || form.priceVaries ? 0 : form.price,
      category: form.category,
      condition: isServiceCategory ? null : form.condition,
      serviceType: isServiceCategory ? form.serviceType : null,
      images: form.images,
      contact: form.contact,
      hostelId: form.hostelId,
    });

    const fieldErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
    }
    if (mode.kind === "admin-create" && !form.vendorName.trim()) {
      fieldErrors.vendorName = "Vendor name is required";
    }
    if (Object.keys(fieldErrors).length > 0 || !result.success) {
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    const payload = result.data;

    if (mode.kind === "create") {
      createListing.mutate(
        { ...payload, priceVaries: form.priceVaries },
        {
          onSuccess: () => setSubmitted(true),
          onError: (err) => setFormError(listingErrorMessage(err, "Couldn't post your listing — try again.")),
        }
      );
    } else if (mode.kind === "admin-create") {
      // contact doubles as vendor_whatsapp -- keeps every existing
      // WhatsApp-inquiry UI (buttons/links reading `contact`) working
      // unchanged for admin-assisted listings, no separate field to wire up.
      createListing.mutate(
        { ...payload, vendorName: form.vendorName.trim(), vendorWhatsapp: payload.contact, isUnclaimed: true, priceVaries: form.priceVaries },
        {
          onSuccess: () => setSubmitted(true),
          onError: (err) => setFormError(listingErrorMessage(err, "Couldn't post this listing — try again.")),
        }
      );
    } else {
      updateListing.mutate(
        { listingId: mode.listingId, ...payload, priceVaries: form.priceVaries },
        {
          onSuccess: () => router.push(`/market/${mode.listingId}`),
          onError: (err) => setFormError(err instanceof Error ? err.message : "Couldn't save your changes — try again."),
        }
      );
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <CheckCircle2 className="size-7" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-h1 text-ink-900">Listed!</h2>
          <p className="text-body text-ink-500">
            {mode.kind === "admin-create"
              ? "Saved under your account until the vendor claims it."
              : "Your listing is live on the marketplace."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setForm(blankState());
              setSubmitted(false);
            }}
          >
            {mode.kind === "admin-create" ? "Add another" : "List another"}
          </Button>
          <Button variant="accent" onClick={() => router.push(mode.kind === "admin-create" ? "/admin/market" : "/market")}>
            {mode.kind === "admin-create" ? "Back to Market Admin" : "Browse Market"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-4 py-5">
      <h1 className="font-display text-h1 text-ink-900">
        {mode.kind === "create" ? "Sell something" : mode.kind === "admin-create" ? "Add a vendor's product" : "Edit listing"}
      </h1>

      {mode.kind === "admin-create" && (
        <section>
          <Input
            label="Vendor name"
            placeholder="e.g. Ama's Kitchen"
            value={form.vendorName}
            onChange={(e) => set("vendorName", e.target.value)}
            error={errors.vendorName}
          />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <ImageUploader
          bucket="market-images"
          label="Photos"
          value={form.images}
          onChange={(images) => set("images", images)}
          maxFiles={5}
        />
        {errors.images && <p className="text-body-sm text-danger">{errors.images}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <Input
          label="Title"
          placeholder="e.g. Study table, good condition"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          error={errors.title}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-label label text-ink-500">
              {form.category === "services" ? "Rate (GHS)" : "Price (GHS)"}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, isFree: !prev.isFree, priceVaries: false }))}
                className={cn(
                  "rounded-pill px-3 py-1 text-caption font-medium",
                  form.isFree ? "bg-brand-800 text-white" : "bg-surface-muted text-ink-500"
                )}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, priceVaries: !prev.priceVaries, isFree: false }))}
                className={cn(
                  "rounded-pill px-3 py-1 text-caption font-medium",
                  form.priceVaries ? "bg-brand-800 text-white" : "bg-surface-muted text-ink-500"
                )}
              >
                Price varies
              </button>
            </div>
          </div>
          {!form.isFree && !form.priceVaries && (
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              error={errors.price}
            />
          )}
          {form.priceVaries && (
            <p className="text-body-sm text-ink-500">
              Use this for a flyer with several items or prices — buyers will see &quot;Price varies&quot; and ask you directly.
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-label label text-ink-500">Category</span>
        <div className="grid grid-cols-3 gap-2">
          {MARKET_CATEGORY_ORDER.map((category) => {
            const config = MARKET_CATEGORY_CONFIG[category];
            const Icon = config.icon;
            const active = form.category === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => set("category", category)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-md border p-3 text-caption",
                  active ? "border-brand-800 bg-brand-50 text-brand-800" : "border-line text-ink-500"
                )}
              >
                <Icon className="size-5" />
                {config.label}
              </button>
            );
          })}
        </div>
        {errors.category && <p className="text-body-sm text-danger">{errors.category}</p>}
      </section>

      {form.category && form.category !== "services" ? (
        <section className="flex flex-col gap-3">
          <span className="text-label label text-ink-500">Condition</span>
          <div className="flex flex-wrap gap-2">
            {MARKET_CONDITION_ORDER.map((condition) => (
              <button
                key={condition}
                type="button"
                onClick={() => set("condition", condition)}
                className={cn(
                  "rounded-pill px-3 py-1.5 text-body-sm font-medium",
                  form.condition === condition ? "bg-brand-800 text-white" : "bg-surface-muted text-ink-500"
                )}
              >
                {conditionLabel(condition)}
              </button>
            ))}
          </div>
          {errors.condition && <p className="text-body-sm text-danger">{errors.condition}</p>}
        </section>
      ) : form.category === "services" ? (
        <section className="flex flex-col gap-3">
          <span className="text-label label text-ink-500">Service type (optional)</span>
          <div className="flex flex-wrap gap-2">
            {SERVICE_TYPE_ORDER.map((serviceType) => (
              <button
                key={serviceType}
                type="button"
                onClick={() => set("serviceType", form.serviceType === serviceType ? null : serviceType)}
                className={cn(
                  "rounded-pill px-3 py-1.5 text-body-sm font-medium",
                  form.serviceType === serviceType ? "bg-brand-800 text-white" : "bg-surface-muted text-ink-500"
                )}
              >
                {serviceTypeLabel(serviceType)}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <Textarea
          label="Description (optional)"
          placeholder={
            form.category === "services"
              ? "What do you offer? Include your experience and availability."
              : "Any details buyers should know?"
          }
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          error={errors.description}
        />
      </section>

      <section>
        <Input
          label={mode.kind === "admin-create" ? "Vendor's WhatsApp number" : "WhatsApp number"}
          placeholder="024 000 0000"
          value={form.contact}
          onChange={(e) => set("contact", e.target.value)}
          error={errors.contact}
        />
      </section>

      <section className="flex flex-col gap-1.5">
        <label htmlFor="market-hostel-select" className="text-label label text-ink-500">
          Which hostel are you at? (optional)
        </label>
        <select
          id="market-hostel-select"
          value={form.hostelId ?? ""}
          onChange={(e) => set("hostelId", e.target.value || null)}
          className="min-h-11 rounded-md border border-line bg-surface px-3.5 text-body text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:border-brand-600"
        >
          <option value="">Not linked to a hostel</option>
          {hostelOptions.map((hostel) => (
            <option key={hostel.id} value={hostel.id}>
              {hostel.name}
            </option>
          ))}
        </select>
        <p className="text-body-sm text-ink-500">
          Shown to students browsing that hostel&apos;s page — skip this if it doesn&apos;t apply.
        </p>
      </section>

      {formError && <p className="text-body-sm text-danger">{formError}</p>}

      <Button type="submit" variant="accent" size="lg" loading={isPending}>
        {mode.kind === "edit" ? "Save changes" : "Post listing"}
      </Button>
    </form>
  );
}
