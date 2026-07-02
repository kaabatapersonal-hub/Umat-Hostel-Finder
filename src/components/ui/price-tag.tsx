import { cn } from "@/lib/utils";

export interface PriceTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
  period?: string;
  currency?: string;
}

export function PriceTag({
  className,
  amount,
  period = "year",
  currency = "GHS",
  ...props
}: PriceTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 rounded-pill bg-gold-500 px-3 py-1 text-ink-900",
        className
      )}
      {...props}
    >
      <span className="font-display text-body-strong font-semibold">
        {currency} {amount.toLocaleString()}
      </span>
      <span className="text-caption opacity-80">/ {period}</span>
    </span>
  );
}
