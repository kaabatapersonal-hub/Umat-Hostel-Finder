"use client";

import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { MarketListingForm } from "@/components/market/market-listing-form";
import { useAuth } from "@/providers/auth-provider";

export default function SellPage() {
  const { user, loading, requireAuth } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-7" strokeWidth={1.75} />}
        title="Sign in to sell something"
        description="Listings are tied to your account so you can manage them and buyers can trust who's selling."
        actionLabel="Sign In"
        onAction={() => requireAuth(() => {})}
        className="mx-4 mt-6 bg-surface shadow-card"
      />
    );
  }

  return <MarketListingForm mode={{ kind: "create" }} />;
}
