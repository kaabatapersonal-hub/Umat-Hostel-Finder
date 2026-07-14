import { MarketListingDetailView } from "@/components/market/market-listing-detail-view";

type PageProps = { params: Promise<{ id: string }> };

export default async function MarketListingPage({ params }: PageProps) {
  const { id } = await params;
  return <MarketListingDetailView listingId={id} />;
}
