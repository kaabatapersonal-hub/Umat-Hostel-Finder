import Link from "next/link";
import { ShoppingBag, ChevronRight } from "lucide-react";

// Market's entry point on Home, not a 6th bottom-nav slot (a 6th icon in
// that row would crowd the thumb-reach tab bar). Always links to /market
// regardless of the feature flag -- that route itself decides whether to
// show the "coming soon" teaser or the real feed, so this banner never
// needs to know the flag's state.
export function MarketBanner() {
  return (
    <Link
      href="/market"
      className="mx-auto flex w-full max-w-7xl items-center gap-3 rounded-lg bg-brand-50 px-4 py-3 text-brand-800 shadow-card"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-800 text-white">
        <ShoppingBag className="size-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-strong">Student Marketplace</span>
        <span className="text-caption text-ink-500">Buy, sell, and trade with fellow UMaT students</span>
      </div>
      <ChevronRight className="size-5 shrink-0" />
    </Link>
  );
}
