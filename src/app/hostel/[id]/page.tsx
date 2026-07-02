import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default async function HostelDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col px-4 pt-6">
      <EmptyState
        icon={<Building2 className="size-7" strokeWidth={1.75} />}
        title="Hostel details — coming in Session 4"
        description={`We'll show everything about hostel #${id} here: photos, pricing, availability, and reviews.`}
        className="bg-surface shadow-card"
      />
    </div>
  );
}
