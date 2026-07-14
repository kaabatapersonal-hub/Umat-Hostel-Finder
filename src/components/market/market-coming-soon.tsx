import { ShoppingBag } from "lucide-react";

export function MarketComingSoon() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-800">
        <ShoppingBag className="size-8" strokeWidth={1.75} />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-h1 text-ink-900">Student Marketplace — coming soon</h1>
        <p className="max-w-xs text-body text-ink-500">Buy, sell, and trade with fellow UMaT students.</p>
      </div>
    </div>
  );
}
