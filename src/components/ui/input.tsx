import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-label label text-ink-500">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            "min-h-11 rounded-md border border-line bg-surface px-3.5 text-body text-ink-900",
            "placeholder:text-ink-300",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:border-brand-600",
            "disabled:opacity-50 disabled:pointer-events-none",
            error && "border-danger focus-visible:ring-danger",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-body-sm text-danger">{error}</p>
        ) : helperText ? (
          <p className="text-body-sm text-ink-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, helperText, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-label label text-ink-500">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            "min-h-24 rounded-md border border-line bg-surface px-3.5 py-2.5 text-body text-ink-900",
            "placeholder:text-ink-300",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:border-brand-600",
            "disabled:opacity-50 disabled:pointer-events-none",
            error && "border-danger focus-visible:ring-danger",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-body-sm text-danger">{error}</p>
        ) : helperText ? (
          <p className="text-body-sm text-ink-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
