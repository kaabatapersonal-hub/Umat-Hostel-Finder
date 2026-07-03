"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/ui/image-uploader";
import { RoomTypeEditor } from "./room-type-editor";
import { FacilitiesPicker } from "./facilities-picker";
import { ContactFields } from "./contact-fields";
import { LocationPicker } from "./location-picker";
import { ChipInput } from "./chip-input";
import type { RoomTypeDraft } from "./room-type-row";
import { useSubmitHostel } from "@/hooks/use-submit-hostel";
import { submitHostelSchema } from "@/lib/submit-hostel";
import { normalizePhoneNumber } from "@/lib/contact";
import { ROOM_TYPE_ORDER } from "@/lib/room-types";
import type { UploadedImage } from "@/lib/images";

interface FormErrors {
  name?: string;
  location?: string;
  roomTypes?: string;
  roomTypeRows?: Record<number, { type?: string; price?: string }>;
  whatsappNumber?: string;
  callNumber?: string;
}

function makeInitialRoomType(): RoomTypeDraft {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: ROOM_TYPE_ORDER[0], price: "", images: [] };
}

function initialState() {
  return {
    name: "",
    location: "",
    distanceText: "",
    description: "",
    roomTypes: [makeInitialRoomType()] as RoomTypeDraft[],
    images: [] as UploadedImage[],
    facilities: [] as string[],
    whatsappNumber: "",
    callNumber: "",
    sameAsWhatsapp: false,
    latitude: null as number | null,
    longitude: null as number | null,
    tags: [] as string[],
  };
}

export function SubmitHostelForm() {
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const submitHostel = useSubmitHostel();

  function set<K extends keyof ReturnType<typeof initialState>>(key: K, value: ReturnType<typeof initialState>[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const finalCallNumber = form.sameAsWhatsapp ? form.whatsappNumber : form.callNumber;

    const result = submitHostelSchema.safeParse({
      name: form.name,
      location: form.location,
      distanceText: form.distanceText.trim() || null,
      description: form.description.trim() || null,
      roomTypes: form.roomTypes.map((r) => ({ type: r.type, price: r.price, images: r.images })),
      images: form.images,
      facilities: form.facilities,
      whatsappNumber: form.whatsappNumber,
      callNumber: finalCallNumber.trim() || null,
      latitude: form.latitude,
      longitude: form.longitude,
      tags: form.tags,
    });

    if (!result.success) {
      const nextErrors: FormErrors = {};
      const roomTypeRows: Record<number, { type?: string; price?: string }> = {};

      // A single field can raise more than one issue (e.g. an empty
      // WhatsApp number fails both .min(1) and the phone-format refine) --
      // keep the first, since Zod evaluates chained checks in the order
      // they're declared and the earliest one is the most specific
      // ("required" beats "not a valid phone number" for an empty field).
      for (const issue of result.error.issues) {
        const [first, second, third] = issue.path;
        if (first === "roomTypes") {
          if (typeof second === "number") {
            const row = roomTypeRows[second] ?? {};
            if (third === "price") row.price ??= issue.message;
            else if (third === "type") row.type ??= issue.message;
            roomTypeRows[second] = row;
          } else {
            nextErrors.roomTypes ??= issue.message;
          }
        } else if (first === "name") nextErrors.name ??= issue.message;
        else if (first === "location") nextErrors.location ??= issue.message;
        else if (first === "whatsappNumber") nextErrors.whatsappNumber ??= issue.message;
        else if (first === "callNumber") nextErrors.callNumber ??= issue.message;
      }

      setErrors({ ...nextErrors, roomTypeRows });
      setFormError("Please fix the highlighted fields and try again.");
      return;
    }

    setErrors({});
    const data = result.data;

    submitHostel.mutate(
      {
        name: data.name,
        location: data.location,
        distanceText: data.distanceText,
        description: data.description,
        roomTypes: data.roomTypes,
        images: data.images,
        facilities: data.facilities,
        contact: normalizePhoneNumber(data.whatsappNumber),
        callNumber: data.callNumber ? normalizePhoneNumber(data.callNumber) : null,
        latitude: data.latitude,
        longitude: data.longitude,
        tags: data.tags,
      },
      {
        onSuccess: () => setSubmitted(true),
        onError: (err) => {
          setFormError(err instanceof Error ? err.message : "Something went wrong. Check your connection and try again.");
        },
      }
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-12 text-center shadow-card">
        <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <CheckCircle2 className="size-7" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-h1 text-ink-900">Submitted!</h2>
          <p className="max-w-xs text-body text-ink-500">
            An admin will review your hostel and you&apos;ll be notified. This usually isn&apos;t instant.
          </p>
        </div>
        <div className="mt-2 flex w-full flex-col gap-2">
          <Link href="/profile">
            <Button variant="primary" size="lg" className="w-full">
              View My Submissions
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="lg"
            className="w-full"
            onClick={() => {
              setForm(initialState());
              setSubmitted(false);
            }}
          >
            Submit Another Hostel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 pb-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">Basics</h2>
        <Input label="Hostel name" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
        <Input
          label="Location / area"
          placeholder="e.g. North Campus"
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          error={errors.location}
        />
        <Input
          label="Distance from campus (optional)"
          placeholder="e.g. 12 mins walk"
          value={form.distanceText}
          onChange={(e) => set("distanceText", e.target.value)}
        />
        <Textarea
          label="Description (optional)"
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">Room types & prices</h2>
        <RoomTypeEditor
          value={form.roomTypes}
          onChange={(next) => set("roomTypes", next)}
          errors={errors.roomTypeRows}
          formError={errors.roomTypes}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">Photos</h2>
        <ImageUploader bucket="hostel-images" label="Hostel photos" value={form.images} onChange={(next) => set("images", next)} maxFiles={10} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">Facilities</h2>
        <FacilitiesPicker value={form.facilities} onChange={(next) => set("facilities", next)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">Contact</h2>
        <ContactFields
          whatsappNumber={form.whatsappNumber}
          callNumber={form.callNumber}
          sameAsWhatsapp={form.sameAsWhatsapp}
          onWhatsappChange={(v) => set("whatsappNumber", v)}
          onCallChange={(v) => set("callNumber", v)}
          onSameAsWhatsappChange={(v) => set("sameAsWhatsapp", v)}
          errors={{ whatsappNumber: errors.whatsappNumber, callNumber: errors.callNumber }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">Location on map</h2>
        <LocationPicker
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">Tags (optional)</h2>
        <ChipInput value={form.tags} onChange={(next) => set("tags", next)} placeholder="e.g. near_campus, quiet" />
      </section>

      {formError && <p className="text-body-sm text-danger">{formError}</p>}

      <Button type="submit" variant="accent" size="lg" loading={submitHostel.isPending}>
        Submit for Review
      </Button>
    </form>
  );
}
