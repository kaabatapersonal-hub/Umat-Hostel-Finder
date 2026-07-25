"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// A personal trust badge (campus influencers, SRC leaders, ...) --
// distinct from Buzz's "Official" badge (which means "an admin wrote
// this"), this means "this specific person is verified," independent of
// role. label is shown natively on hover (desktop) via `title`; on
// mobile, tapping reveals it inline since there's no hover to rely on.
export function VerifiedBadge({ label, className }: { label?: string | null; className?: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        title={label ?? undefined}
        aria-label={label ? `Verified — ${label}` : "Verified"}
        onClick={(e) => {
          if (!label) return;
          e.preventDefault();
          e.stopPropagation();
          setRevealed((v) => !v);
        }}
        className={cn("flex items-center", label && "cursor-pointer", className)}
      >
        <BadgeCheck className="size-3.5 shrink-0 fill-gold-500 text-white" strokeWidth={2} />
      </button>
      {revealed && label && (
        <span className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-caption text-white shadow-md">
          {label}
        </span>
      )}
    </span>
  );
}
