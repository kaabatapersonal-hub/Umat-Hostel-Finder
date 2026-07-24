"use client";

import { Input } from "@/components/ui/input";

export interface ContactFieldsProps {
  whatsappNumber: string;
  callNumber: string;
  sameAsWhatsapp: boolean;
  onWhatsappChange: (value: string) => void;
  onCallChange: (value: string) => void;
  onSameAsWhatsappChange: (value: boolean) => void;
  errors?: { whatsappNumber?: string; callNumber?: string };
}

export function ContactFields({
  whatsappNumber,
  callNumber,
  sameAsWhatsapp,
  onWhatsappChange,
  onCallChange,
  onSameAsWhatsappChange,
  errors,
}: ContactFieldsProps) {
  // Derived, not synced via an effect -- when the checkbox is on, the call
  // field's displayed value is just whatever WhatsApp says right now.
  const displayedCall = sameAsWhatsapp ? whatsappNumber : callNumber;

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="WhatsApp number"
        type="tel"
        inputMode="tel"
        placeholder="024 000 0000"
        value={whatsappNumber}
        onChange={(e) => onWhatsappChange(e.target.value)}
        error={errors?.whatsappNumber}
        helperText="Required — students message you here first."
      />

      <label className="flex items-center gap-2 text-body-sm text-ink-500">
        <input
          type="checkbox"
          checked={sameAsWhatsapp}
          onChange={(e) => onSameAsWhatsappChange(e.target.checked)}
          className="size-4 rounded-sm border-line accent-brand-800"
        />
        Call number is the same as WhatsApp
      </label>

      <Input
        label="Call number (optional)"
        type="tel"
        inputMode="tel"
        placeholder="024 000 0000"
        value={displayedCall}
        onChange={(e) => onCallChange(e.target.value)}
        disabled={sameAsWhatsapp}
        error={errors?.callNumber}
      />
    </div>
  );
}
