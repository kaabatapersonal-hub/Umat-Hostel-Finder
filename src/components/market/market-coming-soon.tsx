"use client";

import { useRouter } from "next/navigation";
import { Rocket, Tag, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePendingLaunchCount } from "@/hooks/use-pending-launch-count";

const BENEFITS = [
  { icon: Tag, text: "List for free, no seller fees" },
  { icon: Users, text: "Reach every student on campus" },
  { icon: Zap, text: "Go live automatically the moment we launch" },
];

// Marketplace isn't actually gated pre-launch -- listing submission has
// always worked (see createMarketListing/protect_market_listing_writes),
// it's just held as 'pending_launch' until app_config.marketplace_enabled
// flips on, at which point toggle_marketplace bulk-promotes every pending
// listing to 'active' with zero seller action required. So this screen's
// job is purely motivational: convince people to list *now* rather than
// wait, not explain a restriction that doesn't exist.
export function MarketComingSoon() {
  const router = useRouter();
  const { data: pendingCount } = usePendingLaunchCount();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-800">
        <Rocket className="size-8" strokeWidth={1.75} />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-h1 text-ink-900">Marketplace launching soon 🚀</h1>
        <p className="max-w-xs text-body text-ink-500">
          Be among the first sellers — list your items now and they&apos;ll go live the instant we open.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {BENEFITS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-body-sm text-ink-700">
            <Icon className="size-4 shrink-0 text-brand-800" strokeWidth={2} />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      <Button variant="accent" size="lg" className="mt-1" onClick={() => router.push("/market/sell")}>
        Add Your Product
      </Button>

      {!!pendingCount && pendingCount > 0 && (
        <p className="text-caption text-ink-500">
          {pendingCount} {pendingCount === 1 ? "product" : "products"} already submitted
        </p>
      )}
    </div>
  );
}
