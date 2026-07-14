import { SellerSaleView } from "@/components/market/seller-sale-view";

type PageProps = { params: Promise<{ userId: string }> };

export default async function SellerSalePage({ params }: PageProps) {
  const { userId } = await params;
  return <SellerSaleView sellerId={userId} />;
}
