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

export type MarketListingFormMode = { kind: "create" } | { kind: "edit"; listingId: string };

interface MarketListingFormState {
  title: string;
  description: string;
  price: string;
  isFree: boolean;
  category: MarketCategory | null;
  condition: MarketCondition | null;
  serviceType: MarketServiceType | null;
  images: UploadedImage[];
  contact: string;
  hostelId: string | null;
}

function blankState(): MarketListingFormState {
  return {
    title: "",
    description: "",
    price: "",
    isFree: false,
    category: null,
    condition: null,
    serviceType: null,
    images: [],
    contact: "",
    hostelId: null,
  };
}

function listingToFormState(listing: MarketListing): MarketListingFormState {
  return {
    title: listing.title,
    description: listing.description ?? "",
    price: listing.price === 0 ? "" : String(listing.price),
    isFree: listing.price === 0,
    category: listing.category,
    condition: listing.condition,
    serviceType: listing.serviceType,
    images: listing.images,
    contact: listing.contact,
    hostelId: listing.hostelId,
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
      price: form.isFree ? 0 : form.price,
      category: form.category,
      condition: isServiceCategory ? null : form.condition,
      serviceType: isServiceCategory ? form.serviceType : null,
      images: form.images,
      contact: form.contact,
      hostelId: form.hostelId,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    const payload = result.data;

    if (mode.kind === "create") {
      createListing.mutate(payload, {
        onSuccess: () => setSubmitted(true),
        onError: (err) => setFormError(err instanceof Error ? err.message : "Couldn't post your listing — try again."),
      });
    } else {
      updateListing.mutate(
        { listingId: mode.listingId, ...payload },
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
          <p className="text-body text-ink-500">Your listing is live on the marketplace.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setForm(blankState());
              setSubmitted(false);
            }}
          >
            List another
          </Button>
          <Button variant="accent" onClick={() => router.push("/market")}>
            Browse Market
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-4 py-5">
      <h1 className="font-display text-h1 text-ink-900">{mode.kind === "create" ? "Sell something" : "Edit listing"}</h1>

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
            <button
              type="button"
              onClick={() => set("isFree", !form.isFree)}
              className={cn(
                "rounded-pill px-3 py-1 text-caption font-medium",
                form.isFree ? "bg-brand-800 text-white" : "bg-surface-muted text-ink-500"
              )}
            >
              Free
            </button>
          </div>
          {!form.isFree && (
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
          label="WhatsApp number"
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
        {mode.kind === "create" ? "Post listing" : "Save changes"}
      </Button>
    </form>
  );
}
