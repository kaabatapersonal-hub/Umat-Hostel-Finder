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
  // "From" for a service's rate ("From GHS 50") -- a service's price is a
  // starting rate, not a fixed one-off asking price, so it reads
  // differently from a physical item's tag even though it's the same pill.
  // Named pricePrefix, not prefix -- `prefix` collides with a real (if
  // obscure) global HTML/React attribute already present on
  // HTMLAttributes<HTMLSpanElement>.
  pricePrefix?: string | null;
}

export function PriceTag({
  className,
  amount,
  max,
  period = "year",
  currency = "GHS",
  pricePrefix,
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
        {pricePrefix && !isFree && `${pricePrefix} `}
        {isFree ? "Free" : `${currency} ${amount.toLocaleString()}`}
        {isRange && ` – ${max.toLocaleString()}`}
      </span>
      {period && <span className="text-caption opacity-80">/ {period}</span>}
    </span>
  );
}

// Same pill shape as PriceTag, deliberately muted (not gold) -- for a
// price that isn't confirmed yet rather than one that's free or unknown.
// Gold means "here's a real number"; this means "ask, don't assume."
export function PricePendingPill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 rounded-pill bg-surface-muted px-3 py-1 text-ink-500",
        className
      )}
    >
      <span className="text-body-strong font-semibold">{label}</span>
    </span>
  );
}
