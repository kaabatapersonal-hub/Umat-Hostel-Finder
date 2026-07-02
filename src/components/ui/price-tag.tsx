import { cn } from "@/lib/utils";

export interface PriceTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
  // If provided and different from `amount`, renders a range
  // ("GHS 1,500 – 3,500 / year") instead of a single price. Pass the
  // cheapest room's price as `amount` and the priciest as `max`.
  max?: number;
  period?: string;
  currency?: string;
}

export function PriceTag({
  className,
  amount,
  max,
  period = "year",
  currency = "GHS",
  ...props
}: PriceTagProps) {
  const isRange = max !== undefined && max !== amount;

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
        {isRange && ` – ${max.toLocaleString()}`}
      </span>
      <span className="text-caption opacity-80">/ {period}</span>
    </span>
  );
}
