import { Map } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function MapPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Map" subtitle="See hostels near campus at a glance" />
      <EmptyState
        icon={<Map className="size-7" strokeWidth={1.75} />}
        title="The map is warming up"
        description="We're plotting every hostel around UMaT so you can browse by location. Check back soon."
        className="mx-4 mt-4 bg-surface shadow-card"
      />
    </div>
  );
}
