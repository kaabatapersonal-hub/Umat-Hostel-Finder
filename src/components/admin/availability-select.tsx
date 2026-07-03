"use client";

import { useSetHostelAvailability } from "@/hooks/use-set-hostel-availability";

const OPTIONS = [
  { value: "available", label: "Available" },
  { value: "filling", label: "Filling Up" },
  { value: "full", label: "Full" },
];

export interface AvailabilitySelectProps {
  hostelId: string;
  availability: string;
}

export function AvailabilitySelect({ hostelId, availability }: AvailabilitySelectProps) {
  const setAvailability = useSetHostelAvailability();

  return (
    <select
      value={availability}
      onChange={(e) => setAvailability.mutate({ id: hostelId, availability: e.target.value })}
      disabled={setAvailability.isPending}
      aria-label="Availability"
      className="rounded-md border border-line bg-surface px-2 py-1.5 text-body-sm text-ink-900 disabled:opacity-60"
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
