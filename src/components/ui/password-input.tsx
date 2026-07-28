"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  helperText?: string;
  error?: string;
}

// Same visual shell as Input, but the show/hide toggle needs to sit
// inside the same relative box as the <input> itself (not the outer
// label+input column Input.tsx wraps everything in), so this is its own
// small component rather than a prop bolted onto Input for the one field
// that needs it.
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, helperText, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-label label text-ink-500">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            aria-invalid={!!error}
            className={cn(
              "min-h-11 w-full rounded-md border border-line bg-surface px-3.5 pr-11 text-body text-ink-900",
              "placeholder:text-ink-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:border-brand-600",
              "disabled:opacity-50 disabled:pointer-events-none",
              error && "border-danger focus-visible:ring-danger",
              className
            )}
            {...props}
          />
          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-300 hover:text-ink-500"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {error ? (
          <p className="text-body-sm text-danger">{error}</p>
        ) : helperText ? (
          <p className="text-body-sm text-ink-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
