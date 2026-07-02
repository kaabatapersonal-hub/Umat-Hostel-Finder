"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-900",
  accent: "bg-gold-500 text-ink-900 hover:bg-gold-600",
  secondary: "bg-surface text-brand-800 border border-brand-800 hover:bg-brand-50",
  ghost: "bg-transparent text-ink-900 hover:bg-surface-muted",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-body-sm gap-1.5",
  md: "h-11 px-4 text-body-strong gap-2",
  lg: "h-12 px-6 text-body-strong gap-2 min-h-[48px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileTap={disabled || loading ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors",
          "disabled:opacity-50 disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
