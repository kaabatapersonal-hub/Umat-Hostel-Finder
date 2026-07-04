import { cn } from "@/lib/utils";

type BadgeVariant = "featured" | "available" | "filling" | "full" | "neutral";
type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantClasses: Record<BadgeVariant, string> = {
  featured: "bg-gold-500 text-ink-900",
  // A soft tint, not a solid bright-green fill -- keeps this AA-compliant
  // (white-on-#009639 was ~3.9:1, below the 4.5:1 small text needs) and
  // avoids the "municipal" look of a large bright-green fill.
  available: "bg-brand-50 text-brand-800",
  filling: "bg-gold-50 text-gold-600",
  // Solid, not a translucent tint -- "Full" is the one state worth a
  // harder stop, and a 10%-opacity fill all but disappears over a photo
  // thumbnail (this badge floats over card images). White-on-danger still
  // clears AA (~4.9:1).
  full: "bg-danger text-white",
  neutral: "bg-surface-muted text-ink-500",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "h-5 px-2 text-caption",
  md: "h-6 px-2.5 text-body-sm",
};

export function Badge({ className, variant = "neutral", size = "sm", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-pill font-medium whitespace-nowrap",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export const Chip = Badge;
