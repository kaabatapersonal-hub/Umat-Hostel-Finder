import { createStaticClient } from "@/lib/supabase/server";
import { getAppConfigBoolean } from "@/lib/queries/app-config";
import { MarketComingSoon } from "@/components/market/market-coming-soon";
import { MarketFeedView } from "@/components/market/market-feed-view";

// Without this, Next statically prerenders the page at build time (no
// cookies/headers/searchParams dependency to signal otherwise) and bakes
// in whatever the flag happened to be during that build -- flipping
// marketplace_enabled in the database would then need a full redeploy to
// take effect, defeating the entire point of a flippable flag.
export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const supabase = createStaticClient();
  const enabled = await getAppConfigBoolean(supabase, "marketplace_enabled", false);

  if (!enabled) return <MarketComingSoon />;
  return <MarketFeedView />;
}
