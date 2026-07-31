import { MarketListingForm } from "@/components/market/market-listing-form";

export default function AdminAddProductPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1 text-ink-900">Add a vendor&apos;s product</h1>
        <p className="text-body-sm text-ink-500">
          For vendors who won&apos;t sign up themselves — collect their details over WhatsApp or in person. The listing
          is saved under your account until the vendor claims it from their own profile.
        </p>
      </div>
      <MarketListingForm mode={{ kind: "admin-create" }} />
    </div>
  );
}
