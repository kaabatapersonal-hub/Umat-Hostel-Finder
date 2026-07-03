"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ChipInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

// Free-add chip list: type something, press Add (or Enter), it becomes a
// removable chip. Shared by custom facilities and tags -- both are just
// "a few extra strings the submitter types in" with no DB-level distinction
// from the preset options.
export function ChipInput({ value, onChange, placeholder }: ChipInputProps) {
  const [draft, setDraft] = useState("");

  function addChip() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  function removeChip(chip: string) {
    onChange(value.filter((v) => v !== chip));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addChip();
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-end gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="secondary" size="md" onClick={addChip}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((chip) => (
            <span
              key={chip}
              className="flex items-center gap-1.5 rounded-pill bg-surface-muted py-1.5 pl-3 pr-2 text-body-sm text-ink-900"
            >
              {chip}
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                onClick={() => removeChip(chip)}
                className="flex size-4 items-center justify-center rounded-full text-ink-500 hover:text-ink-900"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
