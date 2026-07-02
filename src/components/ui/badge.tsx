import { cn } from "@/lib/utils";

type BadgeVariant = "featured" | "available" | "filling" | "full" | "neutral";
type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantClasses: Record<BadgeVariant, string> = {
  featured: "bg-gold-500 text-ink-900",
  available: "bg-success text-white",
  filling: "bg-gold-50 text-gold-600",
  full: "bg-danger/10 text-danger",
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
