import { cn } from "@/lib/utils";

export interface PriceTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number;
  // If provided and different from `amount`, renders a range
  // ("GHS 1,500 – 3,500 / year") instead of a single price. Pass the
  // cheapest room's price as `amount` and the priciest as `max`.
  max?: number;
  // Pass null to hide the "/ period" line entirely -- a one-off sale
  // price (marketplace listings) isn't recurring rent, it's a single
  // asking price with nothing to divide by.
  period?: string | null;
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
  const isFree = amount === 0 && !isRange;

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 rounded-pill bg-gold-500 px-3 py-1 text-ink-900",
        className
      )}
      {...props}
    >
      <span className="font-display text-body-strong font-semibold">
        {isFree ? "Free" : `${currency} ${amount.toLocaleString()}`}
        {isRange && ` – ${max.toLocaleString()}`}
      </span>
      {period && <span className="text-caption opacity-80">/ {period}</span>}
    </span>
  );
}
