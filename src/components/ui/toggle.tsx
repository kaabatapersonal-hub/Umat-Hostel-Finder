"use client";

import { cn } from "@/lib/utils";

export interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
  // Gold is the default "on" color everywhere -- the admin marketplace
  // toggle intentionally uses brand green instead, to read as "live" the
  // same way "Live"/"Coming soon" badges elsewhere in admin do.
  activeColorClassName?: string;
}

// One shared switch for the whole app -- this used to be reimplemented by
// hand in 4 different places (push notifications, leaving-campus sale, the
// admin marketplace toggle, the anonymous-post toggle), each positioning
// the knob with `absolute` + a magic translate-x value derived from doing
// the track/knob-size arithmetic by hand. Built the standard way instead
// (flex + a plain translate on the knob, the same shape used by Tailwind
// UI/Radix/every other production switch) so the knob's position is
// never ambiguous, and fixed once here instead of four times.
export function Toggle({ checked, onChange, label, disabled, className, activeColorClassName }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
        checked ? (activeColorClassName ?? "bg-gold-500") : "bg-ink-300",
        className
      )}
    >
      <span
        className={cn(
          "size-6 rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
