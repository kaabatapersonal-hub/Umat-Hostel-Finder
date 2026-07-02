import { Heart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function SavedPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Saved" subtitle="Hostels you're keeping an eye on" />
      <EmptyState
        icon={<Heart className="size-7" strokeWidth={1.75} />}
        title="No saved hostels yet"
        description="Tap the heart on any hostel to keep it here for later."
        className="mx-4 mt-4 bg-surface shadow-card"
      />
    </div>
  );
}
