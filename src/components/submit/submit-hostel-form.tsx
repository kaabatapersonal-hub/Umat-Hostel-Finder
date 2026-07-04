"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Info } from "lucide-react";
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
import { useUpdateSubmission } from "@/hooks/use-update-submission";
import { useSubmitPendingEdit } from "@/hooks/use-submit-pending-edit";
import { useCreateHostelAdmin } from "@/hooks/use-create-hostel-admin";
import { useUpdateHostelAdmin } from "@/hooks/use-update-hostel-admin";
import { submitHostelSchema, type SubmitHostelFormValues } from "@/lib/submit-hostel";
import { normalizePhoneNumber, formatDisplayPhoneNumber } from "@/lib/contact";
import { ROOM_TYPE_ORDER } from "@/lib/room-types";
import type { UploadedImage } from "@/lib/images";
import type { EditableHostelFields } from "@/lib/hostel-fields";

interface FormErrors {
  name?: string;
  location?: string;
  roomTypes?: string;
  roomTypeRows?: Record<number, { type?: string; price?: string }>;
  whatsappNumber?: string;
  callNumber?: string;
}

// Which record a save actually writes to. "create" and the two "edit-*"
// kinds are the Session 8/8.5 student-facing flows; "admin-create" and
// "admin-edit" (Session 10) write directly to a live hostels row -- admin
// already has full RLS rights, so there's no submission queue or pending
// buffer in either direction. "admin-edit-submission" (Session 11) is the
// review queue's edit-before-approve step -- it reuses the exact same
// updateSubmission mutation as a student's own edit-submission mode,
// since admin's UPDATE policy on submissions has no owner/status
// restriction; only the success-screen copy and navigation differ.
export type SubmitFormMode =
  | { kind: "create" }
  | { kind: "edit-submission"; submissionId: string }
  | { kind: "edit-hostel"; hostelId: string; hasPendingEdit: boolean }
  | { kind: "admin-create" }
  | { kind: "admin-edit"; hostelId: string }
  | { kind: "admin-edit-submission"; submissionId: string };

export interface SubmitHostelFormProps {
  mode?: SubmitFormMode;
  initialValues?: EditableHostelFields;
}

function makeInitialRoomType(): RoomTypeDraft {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: ROOM_TYPE_ORDER[0], price: "", images: [] };
}

function blankState(overrides?: { location?: string }) {
  return {
    name: "",
    location: overrides?.location ?? "",
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

function fieldsToFormState(fields: EditableHostelFields): ReturnType<typeof blankState> {
  const sameAsWhatsapp = !!fields.callNumber && normalizePhoneNumber(fields.callNumber) === normalizePhoneNumber(fields.contact);

  return {
    name: fields.name,
    location: fields.location,
    distanceText: fields.distanceText ?? "",
    description: fields.description ?? "",
    roomTypes:
      fields.roomTypes.length > 0
        ? fields.roomTypes.map((rt) => ({
            key: `${rt.type}-${Math.random().toString(36).slice(2)}`,
            type: rt.type,
            price: String(rt.price),
            images: rt.images,
          }))
        : [makeInitialRoomType()],
    images: fields.images,
    facilities: fields.facilities,
    whatsappNumber: formatDisplayPhoneNumber(fields.contact),
    callNumber: sameAsWhatsapp || !fields.callNumber ? "" : formatDisplayPhoneNumber(fields.callNumber),
    sameAsWhatsapp,
    latitude: fields.latitude,
    longitude: fields.longitude,
    tags: fields.tags,
  };
}

function buildEditableFields(data: SubmitHostelFormValues): EditableHostelFields {
  return {
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
  };
}

export function SubmitHostelForm({ mode = { kind: "create" }, initialValues }: SubmitHostelFormProps) {
  const [form, setForm] = useState(() => (initialValues ? fieldsToFormState(initialValues) : blankState()));
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitHostel = useSubmitHostel();
  const updateSubmission = useUpdateSubmission();
  const submitPendingEdit = useSubmitPendingEdit();
  const createHostelAdmin = useCreateHostelAdmin();
  const updateHostelAdmin = useUpdateHostelAdmin();

  const isPending =
    mode.kind === "create"
      ? submitHostel.isPending
      : mode.kind === "edit-submission" || mode.kind === "admin-edit-submission"
        ? updateSubmission.isPending
        : mode.kind === "edit-hostel"
          ? submitPendingEdit.isPending
          : mode.kind === "admin-create"
            ? createHostelAdmin.isPending
            : updateHostelAdmin.isPending;

  function set<K extends keyof ReturnType<typeof blankState>>(key: K, value: ReturnType<typeof blankState>[K]) {
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
    const fields = buildEditableFields(result.data);
    const onError = (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Check your connection and try again.");
    };

    if (mode.kind === "create") {
      submitHostel.mutate(fields, { onSuccess: () => setSubmitted(true), onError });
    } else if (mode.kind === "edit-submission" || mode.kind === "admin-edit-submission") {
      updateSubmission.mutate({ id: mode.submissionId, ...fields }, { onSuccess: () => setSubmitted(true), onError });
    } else if (mode.kind === "edit-hostel") {
      submitPendingEdit.mutate({ hostelId: mode.hostelId, fields }, { onSuccess: () => setSubmitted(true), onError });
    } else if (mode.kind === "admin-create") {
      createHostelAdmin.mutate(fields, { onSuccess: () => setSubmitted(true), onError });
    } else {
      updateHostelAdmin.mutate({ id: mode.hostelId, fields }, { onSuccess: () => setSubmitted(true), onError });
    }
  }

  if (submitted) {
    const copy =
      mode.kind === "create"
        ? {
            title: "Submitted!",
            description: "An admin will review your hostel and you'll be notified. This usually isn't instant.",
          }
        : mode.kind === "edit-submission"
          ? { title: "Changes saved!", description: "Your updated submission is still pending admin review." }
          : mode.kind === "edit-hostel"
            ? {
                title: "Changes submitted!",
                description: "Awaiting admin approval — your current listing stays live and unchanged until then.",
              }
            : mode.kind === "admin-create"
              ? { title: "Hostel added!", description: "It's live immediately — students can find it right now." }
              : mode.kind === "admin-edit-submission"
                ? { title: "Changes saved!", description: "The submission has been updated." }
                : { title: "Saved!", description: "The live listing has been updated." };

    const isAdminMode = mode.kind === "admin-create" || mode.kind === "admin-edit";
    const primaryHref = isAdminMode ? "/admin/hostels" : mode.kind === "admin-edit-submission" ? "/admin/submissions" : "/profile";
    const primaryLabel = isAdminMode
      ? "Back to Hostels"
      : mode.kind === "admin-edit-submission"
        ? "Back to Submissions"
        : mode.kind === "create"
          ? "View My Submissions"
          : "Back to Profile";

    return (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-12 text-center shadow-card">
        <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <CheckCircle2 className="size-7" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-h1 text-ink-900">{copy.title}</h2>
          <p className="max-w-xs text-body text-ink-500">{copy.description}</p>
        </div>
        <div className="mt-2 flex w-full flex-col gap-2">
          {mode.kind === "admin-create" && (
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              onClick={() => {
                setForm(blankState({ location: form.location }));
                setSubmitted(false);
              }}
            >
              Save & Add Another
            </Button>
          )}
          {mode.kind === "admin-edit-submission" && (
            <Button variant="accent" size="lg" className="w-full" onClick={() => setSubmitted(false)}>
              Continue Reviewing
            </Button>
          )}
          <Link href={primaryHref}>
            <Button variant={isAdminMode || mode.kind === "admin-edit-submission" ? "secondary" : "primary"} size="lg" className="w-full">
              {primaryLabel}
            </Button>
          </Link>
          {mode.kind === "create" && (
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={() => {
                setForm(blankState());
                setSubmitted(false);
              }}
            >
              Submit Another Hostel
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 pb-8">
      {mode.kind === "edit-hostel" && mode.hasPendingEdit && (
        <div className="flex items-start gap-2.5 rounded-md bg-gold-50 p-3.5 text-body-sm text-ink-900">
          <Info className="size-4 shrink-0 translate-y-0.5 text-gold-600" />
          <span>You already have changes awaiting approval for this listing. Saving here replaces them.</span>
        </div>
      )}

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
        <ImageUploader bucket="hostel-images" label="Hostel photos" value={form.images} onChange={(next) => set("images", next)} maxFiles={5} />
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

      <Button type="submit" variant="accent" size="lg" loading={isPending}>
        {mode.kind === "create"
          ? "Submit for Review"
          : mode.kind === "edit-submission" || mode.kind === "admin-edit-submission"
            ? "Save Changes"
            : mode.kind === "edit-hostel"
              ? "Submit Changes for Approval"
              : mode.kind === "admin-create"
                ? "Add Hostel"
                : "Save Changes"}
      </Button>
    </form>
  );
}
